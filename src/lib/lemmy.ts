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

async function request<T>(instance: string, path: string, options: RequestOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);
  headers.set("Accept", "application/json");
  if (fetchOptions.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`https://${instance}/api/v3${path}`, { ...fetchOptions, headers });
  } catch {
    throw new Error(`Could not reach ${instance}. This instance may block browser requests; try another instance or add a Netlify proxy.`);
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

export async function listPosts(instance: string, filters: Filters, page: number, token?: string | null) {
  const params = new URLSearchParams({
    type_: filters.scope,
    sort: resolveSort(filters),
    page: String(page),
    limit: "20",
  });
  // Older Lemmy v3 instances expect auth in the query as well as the bearer header.
  if (token) params.set("auth", token);
  const data = await request<{ posts: PostView[] }>(instance, `/post/list?${params}`, { token });
  return sortPosts(data.posts, filters);
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
    auth: token,
  });
  const data = await request<{ posts: PostView[] }>(instance, `/post/list?${params}`, { token });
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
    my_user?: { local_user_view?: { person: { name: string; display_name?: string; avatar?: string }; local_user: { email?: string } } };
  }>(instance, `/site?${params}`, { token });
  return data.my_user?.local_user_view;
}
