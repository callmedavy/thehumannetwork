import type { AccountNotification, CommentView, Community, Filters, LemmyComment, LemmyPost, Person, PostView } from "../types";
import { crossPostKey } from "./format";
import { WEEKLY_TOP_SIZE, isWithinWeek, weeklyTopSort, type WeekWindow } from "./weeklyTop";

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

function imageEndpoint(instance: string, viaProxy: boolean) {
  return viaProxy ? `/api/lemmy/${instance}/pictrs/image` : `https://${instance}/pictrs/image`;
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
  if (!response.ok) {
    // A 404 on `/api/v3/*` almost always means the entered host is not a Lemmy instance
    // (Mastodon, Kbin/Mbin, a parked domain, or a typo). Say so instead of the generic
    // "Request failed with status 404" — the toast is the reader's only clue.
    const fallback = response.status === 404
      ? `${instance} did not answer as a Lemmy instance (404). Check the address or try another instance.`
      : `Request failed with status ${response.status}`;
    throw new Error(getMessage(payload, fallback));
  }
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
  if (filters.order === "newest") return "New";
  if (filters.date === "today") return "TopDay";
  if (filters.date === "threeDays") return "TopWeek";
  if (filters.date === "week") return "TopWeek";
  if (filters.date === "month") return "TopMonth";
  if (filters.date === "year") return "TopYear";
  if (filters.order === "comments") return "MostComments";
  if (filters.order === "contested") return "Controversial";
  return "TopAll";
}

function sortPosts(posts: PostView[], filters: Filters) {
  const rangeDays = filters.date === "today" ? 1
    : filters.date === "threeDays" ? 3
      : filters.date === "week" ? 7
        : filters.date === "month" ? 30
          : filters.date === "year" ? 365
            : null;
  const shouldFilterLocally = filters.order === "newest" || filters.date === "threeDays";
  const filteredPosts = shouldFilterLocally && rangeDays !== null
    ? posts.filter((post) => new Date(post.post.published).getTime() >= Date.now() - rangeDays * 24 * 60 * 60 * 1000)
    : posts;
  if (filters.order === "top") return filteredPosts;
  return [...filteredPosts].sort((first, second) => {
    if (filters.order === "newest") return new Date(second.post.published).getTime() - new Date(first.post.published).getTime();
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
  });
  // `show_read` is a user-scoped override on Lemmy 0.19.x. Sending it without a JWT trips
  // `not_logged_in` on most instances, so anonymous callers omit it entirely (they have no
  // account-side read state to hide anyway).
  if (token) params.set("show_read", "false");
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

interface ImageUploadResponse {
  files?: Array<{ file?: string; delete_token?: string }>;
  url?: string;
}

export async function uploadImage(instance: string, image: File, token: string) {
  const form = new FormData();
  form.append("images[]", image, image.name);
  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  });

  let response: Response | null = null;
  if (proxyAvailable) {
    try {
      const proxied = await fetch(imageEndpoint(instance, true), { method: "POST", headers, body: form });
      if (proxied.headers.has(PROXY_MARKER)) response = proxied;
      else proxyAvailable = false;
    } catch {
      response = null;
    }
  }

  if (!response) {
    try {
      response = await fetch(imageEndpoint(instance, false), { method: "POST", headers, body: form });
    } catch {
      throw new Error(`Could not upload the image to ${instance}.`);
    }
  }

  const payload = await response.json().catch(() => null) as ImageUploadResponse | null;
  if (!response.ok) throw new Error(getMessage(payload, `Image upload failed with status ${response.status}`));

  const uploadedFile = payload?.files?.[0];
  const filename = uploadedFile?.file;
  if (payload?.url) return { url: new URL(payload.url, `https://${instance}`).toString(), filename, deleteToken: uploadedFile?.delete_token };
  if (!filename) throw new Error("The instance uploaded the image but did not return its address.");
  return {
    url: `https://${instance}/pictrs/image/${filename.split("/").map(encodeURIComponent).join("/")}`,
    filename,
    deleteToken: uploadedFile.delete_token,
  };
}

export async function deleteUploadedImage(instance: string, filename: string, deleteToken: string, token: string) {
  const path = `/pictrs/image/delete/${encodeURIComponent(deleteToken)}/${filename.split("/").map(encodeURIComponent).join("/")}`;
  const headers = new Headers({ Authorization: `Bearer ${token}` });
  for (const method of ["DELETE", "GET"]) {
    let response: Response | null = null;
    if (proxyAvailable) {
      try {
        const proxied = await fetch(`/api/lemmy/${instance}${path}`, { method, headers });
        if (proxied.headers.has(PROXY_MARKER)) response = proxied;
        else proxyAvailable = false;
      } catch {
        response = null;
      }
    }
    if (!response) response = await fetch(`https://${instance}${path}`, { method, headers });
    if (response.ok) return;
    // pict-rs documents both verbs; some reverse proxies permit only one.
    if (response.status !== 405) throw new Error(`Could not remove unused upload (${response.status}).`);
  }
  throw new Error("Could not remove unused upload.");
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

export const WEEKLY_TOP_PAGE_SIZE = 50;

/**
 * Hard ceiling on pages fetched for a single week.
 *
 * Measured against lemmy.world (0.19.19) while building this: the most recent finished week
 * converges on page 1 — one request — while a week two months back needed 15 pages, about six
 * seconds. Sixteen covers the picker's twelve weeks on an instance that size. Reaching the cap
 * means the ranking was never *proven* complete, so `capped` carries that up to the view instead
 * of letting an unfinished chart pass for the week's top ten.
 */
export const WEEKLY_TOP_MAX_PAGES = 16;

export interface WeeklyTopResult {
  posts: PostView[];
  pagesScanned: number;
  /** True when the page cap was reached before the top ten could be proven complete. */
  capped: boolean;
}

/**
 * The top posts of one finished calendar week, ranked by score.
 *
 * Lemmy v3 has no query for "one calendar week" — no `from`/`to`, and its `TopWeek` sort means
 * the seven days before *now* (see `weeklyTopSort`). So this walks the instance's top-sort
 * ranking, `TopMonth` or `TopYear` or `TopAll` depending on how far back the week is, and keeps
 * the posts published inside it. Two things make that exact rather than a hopeful sample:
 *
 * - Lemmy orders these rankings by score descending, so the lowest score on the last page is the
 *   highest score anything still unfetched could reach. Once ten of the week's posts are in hand
 *   and the tenth beats that floor, no unseen post can displace it and the walk stops early. The
 *   most recent finished week is normally answered by the first request.
 * - Posts rank by `score` (upvotes minus downvotes) rather than raw upvotes, because score is what
 *   the instance orders by and what every other surface in this app shows as "points". A tie can
 *   settle a place either way.
 *
 * `type_=All` rather than the reader's own scope: a weekly chart that changed shape with your
 * subscriptions would not be a chart of the instance.
 */
export async function listWeeklyTopPosts(
  instance: string,
  week: WeekWindow,
  options: {
    token?: string | null;
    size?: number;
    /** Honours the cross-post setting: ten slots must not go to one link three times over. */
    collapseCrossPosts?: boolean;
    maxPages?: number;
    /** Called after each page with the running chart, so a slow week fills in instead of hanging. */
    onProgress?: (posts: PostView[]) => void;
  } = {},
): Promise<WeeklyTopResult> {
  const size = options.size ?? WEEKLY_TOP_SIZE;
  const maxPages = options.maxPages ?? WEEKLY_TOP_MAX_PAGES;
  const sort = weeklyTopSort(week);

  // Highest score first; upvotes then recency settle ties so the order holds steady between pages.
  const rankFirst = (first: PostView, second: PostView) =>
    second.counts.score - first.counts.score
    || second.counts.upvotes - first.counts.upvotes
    || new Date(second.post.published).getTime() - new Date(first.post.published).getTime();

  let pool: PostView[] = [];
  const poolIds = new Set<number>();
  const crossPostOwners = new Set<string>();

  const absorb = (posts: PostView[]) => {
    let grew = false;
    posts.forEach((post) => {
      if (poolIds.has(post.post.id)) return;
      if (options.collapseCrossPosts) {
        const key = crossPostKey(post);
        // `pool` stays sorted, so the copy met first — the highest scoring one — is the copy that
        // keeps the slot; the rest are recorded so they cannot come back on a later page.
        if (key && crossPostOwners.has(key)) {
          poolIds.add(post.post.id);
          return;
        }
        if (key) crossPostOwners.add(key);
      }
      poolIds.add(post.post.id);
      pool = [...pool, post];
      grew = true;
    });
    if (grew) pool.sort(rankFirst);
  };

  let cursor: string | null = null;
  let pageNumber = 1;
  let pagesScanned = 0;
  let capped = false;

  while (pagesScanned < maxPages) {
    const params = new URLSearchParams({ type_: "All", sort, limit: String(WEEKLY_TOP_PAGE_SIZE) });
    const known = cursorSupport.get(instance);
    const useCursor = Boolean(cursor) && known !== false;
    // A chart is a record, not a feed: a post the reader has already opened still belongs in it.
    if (options.token) {
      params.set("show_read", "true");
      params.set("auth", options.token);
    }
    if (useCursor) params.set("page_cursor", cursor!);
    else params.set("page", String(pageNumber));

    const data = await request<{ posts?: PostView[]; next_page?: string | null }>(instance, `/post/list?${params}`, { token: options.token });
    pagesScanned += 1;

    const batch = data.posts ?? [];
    const floor = batch.reduce((lowest, post) => Math.min(lowest, post.counts.score), Number.POSITIVE_INFINITY);
    absorb(batch.filter((post) => isWithinWeek(post.post.published, week)));
    options.onProgress?.(pool.slice(0, size));

    // Proven complete: nothing further down the ranking can beat the tenth post already in hand.
    if (pool.length >= size && pool[size - 1].counts.score >= floor) break;

    const nextCursor = typeof data.next_page === "string" && data.next_page ? data.next_page : null;
    if (nextCursor) {
      cursorSupport.set(instance, true);
      cursor = nextCursor;
    } else {
      // Same probe as `listPosts`: a first page with no cursor means this instance pages by number.
      if (known === undefined && !useCursor) cursorSupport.set(instance, false);
      cursor = null;
      pageNumber += 1;
    }

    // The ranking ran out, so the walk has seen every post in its window: nothing was missed.
    if (!nextCursor && batch.length < WEEKLY_TOP_PAGE_SIZE) break;
    if (pagesScanned === maxPages) capped = true;
  }

  return { posts: pool.slice(0, size), pagesScanned, capped };
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
