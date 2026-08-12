import type { AccountNotification, CommentView, Community, Filters, LemmyComment, LemmyPost, Person, PostView } from "../types";

interface RequestOptions extends RequestInit {
  token?: string | null;
}

function getMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;
    if (typeof data.error === "string") return data.error.replaceAll("_", " ");
    if (typeof data.message === "string") return data.message;
  }
  return fallback;
}

// Instances such as lemmy.world reject cross-origin browser calls, so requests go
// through the same-origin Netlify proxy and only fall back to a direct call when
// that proxy is not part of the deployment.
const PROXY_MARKER = "x-lemmy-proxy";
let proxyAvailable = true;

function endpoint(instance: string, path: string, viaProxy: boolean) {
  return viaProxy ? `/api/lemmy/${instance}/api/v3${path}` : `https://${instance}/api/v3${path}`;
}

async function request<T>(instance: string, path: string, options: RequestOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);
  headers.set("Accept", "application/json");
  if (fetchOptions.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response | null = null;

  if (proxyAvailable) {
    try {
      const proxied = await fetch(endpoint(instance, path, true), { ...fetchOptions, headers });
      // Without the marker the request was answered by the SPA fallback, not the proxy.
      if (proxied.headers.has(PROXY_MARKER)) response = proxied;
      else proxyAvailable = false;
    } catch {
      response = null;
    }
  }

  if (!response) {
    try {
      response = await fetch(endpoint(instance, path, false), { ...fetchOptions, headers });
    } catch {
      throw new Error(`Could not reach ${instance}. Check the instance address or try another instance.`);
    }
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(getMessage(payload, `Request failed with status ${response.status}`));
  return payload as T;
}

export async function login(instance: string, username: string, password: string, totp?: string) {
  return request<{ jwt?: string; registration_created?: boolean }>(instance, "/user/login", {
    method: "POST",
    body: JSON.stringify({
      username_or_email: username,
      password,
      ...(totp ? { totp_2fa_token: totp } : {}),
    }),
  });
}

function resolveSort(filters: Filters) {
  if (filters.date === "today") return "TopDay";
  if (filters.date === "week") return "TopWeek";
  if (filters.date === "month") return "TopMonth";
  if (filters.date === "year") return "TopYear";
  if (filters.order === "comments") return "MostComments";
  if (filters.order === "contested") return "Controversial";
  return "TopAll";
}

function sortPosts(posts: PostView[], filters: Filters) {
  if (filters.date === "all" || filters.order === "top") return posts;
  return [...posts].sort((first, second) => {
    if (filters.order === "comments") return second.counts.comments - first.counts.comments;
    const firstRatio = first.counts.upvotes / Math.max(first.counts.downvotes, 1);
    const secondRatio = second.counts.upvotes / Math.max(second.counts.downvotes, 1);
    return Math.abs(firstRatio - 1) - Math.abs(secondRatio - 1);
  });
}

// Lemmy 0.19 replaced numeric pagination with an opaque cursor; numeric pages re-rank
// between requests on Active/Hot-style sorts and resurface posts the reader already saw.
// Support is detected from the first response per instance host and kept for the session.
const cursorSupport = new Map<string, boolean>();

export interface PostPagination {
  cursor?: string | null;
  page?: number;
}

export interface PostPage {
  posts: PostView[];
  nextCursor: string | null;
  cursorPagination: boolean;
}

// Read filtering is the server's job (show_read=false); if read posts still come back the
// instance predates the 0.19.4 filter. Say so once instead of papering over it client-side.
let warnedUnhonoredReadFilter = false;

export async function listPosts(instance: string, filters: Filters, pagination: PostPagination, token?: string | null): Promise<PostPage> {
  const known = cursorSupport.get(instance);
  const useCursor = Boolean(pagination.cursor) && known !== false;
  const params = new URLSearchParams({
    type_: filters.scope,
    sort: resolveSort(filters),
    limit: "20",
    // Feeds always ask the server to omit read posts, regardless of the account's defaults.
    show_read: "false",
  });
  if (useCursor) params.set("page_cursor", pagination.cursor!);
  else params.set("page", String(pagination.page ?? 1));
  // Older Lemmy v3 instances expect auth in the query as well as the bearer header.
  if (token) params.set("auth", token);

  const data = await request<{ posts: PostView[]; next_page?: string | null }>(instance, `/post/list?${params}`, { token });
  const nextCursor = typeof data.next_page === "string" && data.next_page ? data.next_page : null;

  if (nextCursor) cursorSupport.set(instance, true);
  // Only the first page of a scope can prove the instance is pre-0.19; a later page without a
  // cursor simply means the feed ended.
  else if (known === undefined && !pagination.cursor) cursorSupport.set(instance, false);

  if (token && !warnedUnhonoredReadFilter && data.posts.some((post) => post.read)) {
    warnedUnhonoredReadFilter = true;
    console.warn(
      `[the-human-network] ${instance} returned read posts despite show_read=false; the instance likely predates Lemmy 0.19.4, so read posts stay visible in the feed.`,
    );
  }

  return { posts: sortPosts(data.posts, filters), nextCursor, cursorPagination: cursorSupport.get(instance) === true };
}

/**
 * Marks a batch of posts as read on the account's home instance (Lemmy 0.19.4+,
 * `POST /api/v3/post/mark_as_read`). Callers must batch IDs — this is the only transport
 * for read marking and it never sends one request per post.
 *
 * `keepalive` lets the browser finish the request during page unload; it is why this call,
 * unlike the rest of the transport, must keep its body under the keepalive 64 KiB budget
 * (a 20-ID batch is far below it).
 */
export async function markPostsRead(instance: string, postIds: number[], token: string, options: { keepalive?: boolean } = {}) {
  return request(instance, "/post/mark_as_read", {
    method: "POST",
    token,
    keepalive: options.keepalive,
    body: JSON.stringify({ post_ids: postIds, read: true }),
  });
}

export async function listPublishCommunities(instance: string, token: string) {
  const communities = new Map<number, Community>();
  let lastError: unknown;

  for (const type of ["Subscribed", "Local"] as const) {
    const params = new URLSearchParams({
      type_: type,
      sort: "Active",
      page: "1",
      limit: "50",
      auth: token,
    });

    try {
      const data = await request<{ communities: Array<{ community: Community }> }>(instance, `/community/list?${params}`, { token });
      data.communities.forEach(({ community }) => communities.set(community.id, community));
    } catch (error) {
      lastError = error;
    }
  }

  if (!communities.size && lastError) throw lastError;
  return Array.from(communities.values()).sort((first, second) => first.title.localeCompare(second.title));
}

export async function createPost(instance: string, input: { name: string; communityId: number; body?: string; url?: string; nsfw: boolean }, token: string) {
  return request<{ post_view: PostView }>(instance, "/post", {
    method: "POST",
    token,
    body: JSON.stringify({
      name: input.name,
      community_id: input.communityId,
      ...(input.body ? { body: input.body } : {}),
      ...(input.url ? { url: input.url } : {}),
      nsfw: input.nsfw,
      auth: token,
    }),
  });
}

export async function listVotedPosts(instance: string, vote: "up" | "down", page: number, token: string) {
  const params = new URLSearchParams({
    type_: "All",
    sort: "New",
    page: String(page),
    limit: "20",
    // Voting history is a record, not a feed: read posts must stay visible here.
    show_read: "true",
    auth: token,
  });
  params.set(vote === "up" ? "liked_only" : "disliked_only", "true");
  const data = await request<{ posts: PostView[] }>(instance, `/post/list?${params}`, { token });
  return data.posts;
}

export async function listSavedPosts(instance: string, page: number, token: string) {
  const params = new URLSearchParams({
    type_: "All",
    sort: "New",
    page: String(page),
    limit: "50",
    saved_only: "true",
    // Saved posts stay listed even once they are read.
    show_read: "true",
    auth: token,
  });
  const data = await request<{ posts: PostView[] }>(instance, `/post/list?${params}`, { token });
  return data.posts;
}

export const USER_POSTS_PAGE_SIZE = 20;

/**
 * Lists posts authored by one person, newest first (`GET /api/v3/user`). The endpoint returns the
 * person's posts and comments together; only the posts are kept here. `saved_only=false` is sent
 * explicitly because some instances default it to the requester's account preference.
 */
export async function listUserPosts(instance: string, personId: number, page: number, token?: string | null) {
  const params = new URLSearchParams({
    person_id: String(personId),
    sort: "New",
    page: String(page),
    limit: String(USER_POSTS_PAGE_SIZE),
    saved_only: "false",
  });
  if (token) params.set("auth", token);
  const data = await request<{ posts: PostView[] }>(instance, `/user?${params}`, { token });
  return data.posts;
}

export async function getPost(instance: string, postId: number, token?: string | null) {
  const params = new URLSearchParams({ id: String(postId) });
  if (token) params.set("auth", token);
  const data = await request<{ post_view: PostView }>(instance, `/post?${params}`, { token });
  return data.post_view;
}

export async function votePost(instance: string, postId: number, score: -1 | 0 | 1, token: string) {
  return request<{ post_view: PostView }>(instance, "/post/like", {
    method: "POST",
    token,
    body: JSON.stringify({ post_id: postId, score, auth: token }),
  });
}

export async function savePost(instance: string, postId: number, save: boolean, token: string) {
  return request<{ post_view: PostView }>(instance, "/post/save", {
    method: "PUT",
    token,
    body: JSON.stringify({ post_id: postId, save, auth: token }),
  });
}

export async function listComments(instance: string, postId: number, token?: string | null) {
  const params = new URLSearchParams({ post_id: String(postId), type_: "All", sort: "Top", max_depth: "8" });
  if (token) params.set("auth", token);
  const data = await request<{ comments: CommentView[] }>(instance, `/comment/list?${params}`, { token });
  return data.comments;
}

interface CommentNotificationView {
  comment: LemmyComment;
  creator: Person;
  post: LemmyPost;
  community: Community;
}

interface CommentReplyView extends CommentNotificationView {
  comment_reply: { id: number; read: boolean; published: string };
}

interface PersonMentionView extends CommentNotificationView {
  person_mention: { id: number; read: boolean; published: string };
}

interface PrivateMessageView {
  private_message: { id: number; content: string; read: boolean; published: string };
  creator: Person;
}

export async function listNotifications(instance: string, token: string) {
  const commentParams = new URLSearchParams({ sort: "New", page: "1", limit: "50", unread_only: "false", auth: token });
  const messageParams = new URLSearchParams({ page: "1", limit: "50", unread_only: "false", auth: token });
  const [repliesResult, mentionsResult, messagesResult] = await Promise.allSettled([
    request<{ replies: CommentReplyView[] }>(instance, `/user/replies?${commentParams}`, { token }),
    request<{ mentions: PersonMentionView[] }>(instance, `/user/mention?${commentParams}`, { token }),
    request<{ private_messages: PrivateMessageView[] }>(instance, `/private_message/list?${messageParams}`, { token }),
  ]);

  const notifications: AccountNotification[] = [];

  if (repliesResult.status === "fulfilled") {
    notifications.push(...repliesResult.value.replies.map(({ comment_reply, comment, creator, post, community }) => ({
      id: `reply-${comment_reply.id}`,
      kind: "reply" as const,
      creator,
      content: comment.content,
      published: comment_reply.published,
      read: comment_reply.read,
      post,
      community,
    })));
  }

  if (mentionsResult.status === "fulfilled") {
    notifications.push(...mentionsResult.value.mentions.map(({ person_mention, comment, creator, post, community }) => ({
      id: `mention-${person_mention.id}`,
      kind: "mention" as const,
      creator,
      content: comment.content,
      published: person_mention.published,
      read: person_mention.read,
      post,
      community,
    })));
  }

  if (messagesResult.status === "fulfilled") {
    notifications.push(...messagesResult.value.private_messages.map(({ private_message, creator }) => ({
      id: `message-${private_message.id}`,
      kind: "message" as const,
      creator,
      content: private_message.content,
      published: private_message.published,
      read: private_message.read,
    })));
  }

  if (!notifications.length) {
    const firstError = [repliesResult, mentionsResult, messagesResult].find((result) => result.status === "rejected");
    if (!firstError || firstError.status !== "rejected") return notifications;
    throw firstError.reason instanceof Error ? firstError.reason : new Error("Could not load notifications.");
  }

  return notifications.sort((first, second) => new Date(second.published).getTime() - new Date(first.published).getTime());
}

export async function createComment(instance: string, postId: number, content: string, token: string, parentId?: number) {
  return request<{ comment_view: CommentView }>(instance, "/comment", {
    method: "POST",
    token,
    body: JSON.stringify({ post_id: postId, content, ...(parentId ? { parent_id: parentId } : {}), auth: token }),
  });
}

export async function voteComment(instance: string, commentId: number, score: -1 | 0 | 1, token: string) {
  return request<{ comment_view: CommentView }>(instance, "/comment/like", {
    method: "POST",
    token,
    body: JSON.stringify({ comment_id: commentId, score, auth: token }),
  });
}

export async function getProfile(instance: string, token: string) {
  const params = new URLSearchParams({ auth: token });
  const data = await request<{
    my_user?: { local_user_view?: { person: { id: number; name: string; display_name?: string; avatar?: string }; local_user: { email?: string } } };
  }>(instance, `/site?${params}`, { token });
  return data.my_user?.local_user_view;
}
