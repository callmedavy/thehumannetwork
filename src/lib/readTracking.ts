import { markPostsRead } from "./lemmy";

/**
 * Server-side read tracking against the Lemmy account (0.19.4+).
 *
 * The contract, in full:
 *
 * **Two triggers only.** A post is queued for marking-as-read when the reader presses the
 * "Mark Read" button (or its down-swipe gesture equivalent) or when a vote — either
 * direction — succeeds. Nothing else queues a post: not scrolling, not dwell time, not
 * opening the detail sheet, not commenting, not saving. Clearing a vote later does not
 * unmark; a vote is intentional engagement.
 *
 * **Batching.** Queued IDs collect in an in-memory Set and flush as a single
 * `POST /post/mark_as_read` call with `{ post_ids, read: true }` when any of these happens:
 * 1500 ms pass without a new ID (debounce), the buffer reaches 20 IDs, the feed unmounts or
 * the view changes (callers invoke {@link flushPendingReads}), or the page hides/unloads.
 * Single-ID request loops are never sent.
 *
 * **Auth.** Read state lives on the Lemmy account, so every path here no-ops without a JWT.
 * The UI hides its triggers for anonymous readers; this module is the backstop.
 *
 * **Failure.** A failed flush logs and returns its IDs to the buffer for later attempts —
 * three per ID, then the ID is dropped and logged. Flushes are fire-and-forget: they never
 * block feed rendering or vote submission, and optimistic UI updates are never reverted
 * (the server reconciles on the next fetch).
 */

const DEBOUNCE_MS = 1500;
const BATCH_CAP = 20;
const MAX_ATTEMPTS_PER_ID = 3;
// A failed flush waits longer than the debounce before retrying, so a brief network drop
// does not burn all three attempts back-to-back.
const RETRY_DELAY_MS = 5000;

const pending = new Set<number>();
const failedAttempts = new Map<number, number>();
let flushTimer: number | null = null;
let session: { instance: string; token: string | null } = { instance: "", token: null };
// Bumped on every session change so an in-flight flush that fails cannot re-queue the old
// account's IDs into the new account's buffer.
let sessionGeneration = 0;

/**
 * Points the tracker at the active Lemmy session. The store calls this on hydrate, sign-in,
 * browse, and logout. Any IDs still buffered for the previous account are flushed with the
 * previous credentials first — they must never be replayed against a different account.
 */
export function configureReadTracking(instance: string, token: string | null) {
  if (session.token && pending.size) flushPendingReads();
  session = { instance, token };
  sessionGeneration += 1;
  pending.clear();
  failedAttempts.clear();
  cancelScheduledFlush();
}

/**
 * Queues a post ID for the next batched mark_as_read flush. Call this from the two
 * sanctioned triggers only: the "Mark Read" action, and a successful vote response.
 */
export function queueMarkAsRead(postId: number) {
  // TODO: anonymous fallback (tracking read posts without an account) is out of scope.
  if (!session.token || !session.instance) return;
  pending.add(postId);
  if (pending.size >= BATCH_CAP) flushPendingReads();
  else scheduleFlush(DEBOUNCE_MS);
}

/**
 * Sends everything in the buffer as one mark_as_read batch. Safe to call at any time —
 * an empty buffer or missing session is a no-op. Pass `keepalive` from page-hide and
 * unload handlers so the browser finishes the request after the document goes away.
 */
export function flushPendingReads(options: { keepalive?: boolean } = {}) {
  cancelScheduledFlush();
  const { instance, token } = session;
  if (!token || !instance || !pending.size) return;

  const batch = Array.from(pending);
  pending.clear();
  const generation = sessionGeneration;

  markPostsRead(instance, batch, token, options)
    .then(() => batch.forEach((postId) => failedAttempts.delete(postId)))
    .catch((error) => {
      console.warn(`[the-human-network] Could not mark ${batch.length} post(s) as read on ${instance}; keeping them for the next flush.`, error);
      if (generation !== sessionGeneration) return;
      const dropped: number[] = [];
      batch.forEach((postId) => {
        const attempts = (failedAttempts.get(postId) ?? 0) + 1;
        if (attempts >= MAX_ATTEMPTS_PER_ID) {
          failedAttempts.delete(postId);
          dropped.push(postId);
          return;
        }
        failedAttempts.set(postId, attempts);
        pending.add(postId);
      });
      if (dropped.length) console.warn(`[the-human-network] Giving up on marking post(s) ${dropped.join(", ")} as read after ${MAX_ATTEMPTS_PER_ID} attempts.`);
      if (pending.size) scheduleFlush(RETRY_DELAY_MS);
    });
}

function scheduleFlush(delay: number) {
  cancelScheduledFlush();
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    flushPendingReads();
  }, delay);
}

function cancelScheduledFlush() {
  if (flushTimer === null) return;
  window.clearTimeout(flushTimer);
  flushTimer = null;
}

// Best-effort flush when the tab hides or closes. `fetch` with keepalive instead of
// sendBeacon: a beacon cannot carry the Authorization header Lemmy 0.19 requires, so it
// would always arrive unauthenticated.
if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPendingReads({ keepalive: true });
  });
  window.addEventListener("beforeunload", () => flushPendingReads({ keepalive: true }));
}
