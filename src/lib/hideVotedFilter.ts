import type { PostView } from "../types";

/**
 * The "hide voted posts" preference and its predicate.
 *
 * This is the single sanctioned client-side post filter in this codebase. Read filtering is
 * the server's job (`show_read: false` on every feed request), but Lemmy has no equivalent
 * server-side "hide posts I voted on" parameter — a voted post is not read until the vote's
 * mark-as-read flush lands. Filtering on `my_vote` in the response is therefore the only way
 * to offer the preference, and it must stay a render-time filter: switching it off has to
 * bring already-fetched voted posts back without a refetch.
 *
 * The preference is meaningless without an account (guests cannot vote), so the UI hides the
 * toggle when logged out. It persists browser-locally under a single `swimmey:`-namespaced key.
 */

const STORAGE_KEY = "swimmey:hide-voted-posts";

export function loadHideVotedPosts(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveHideVotedPosts(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // A locked-down storage sandbox keeps the preference session-only.
  }
}

export function hasActiveVote(post: PostView): boolean {
  return post.my_vote !== null && post.my_vote !== undefined && post.my_vote !== 0;
}
