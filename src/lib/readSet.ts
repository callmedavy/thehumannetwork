/**
 * Device-local read set: this browser's own record of the posts the reader has marked read.
 *
 * Why it exists alongside the account-side tracker in `readTracking.ts`: Lemmy keeps read state
 * on the account, so that path only works for signed-in readers, and only on instances new
 * enough to honour `show_read=false` (0.19.4+). It also cannot help with a post that is already
 * sitting in the feed queue — that post was fetched before the flag could matter. This set
 * covers all three gaps, and it is what actually holds the promise "a post I marked read does
 * not come up again".
 *
 * Keys are `ap_id`, which is globally unique across the fediverse. The numeric `post.id` alone
 * is not usable: it is assigned per instance, so the same integer is a different post on a
 * different instance. Posts that arrive without an `ap_id` fall back to an instance-scoped key,
 * which cannot collide with another instance's numbering.
 *
 * The set is permanent device state, not session state: it survives a reload, a feed refresh, a
 * logout, and an instance change. Anything less would resurrect read posts. It is capped FIFO so
 * it can never grow without bound, and it is deliberately not keyed to an account — two readers
 * sharing one browser profile share one read set, the same way they share the theme.
 */

const STORAGE_KEY = "swimmey:read-posts";
// ~45 bytes per key, so the cap sits comfortably under a 5 MB localStorage quota. The oldest
// keys are dropped first: a post read a year ago is far less likely to reappear than yesterday's.
const MAX_ENTRIES = 20000;

export interface ReadKeySource {
  id: number;
  ap_id?: string;
}

function load(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    // Corrupt or unavailable storage: start empty rather than throwing during module init.
    return [];
  }
}

let readKeys: string[] = load();
let readIndex = new Set(readKeys);

/**
 * The storage key for a post. Returns null when the post can be neither identified globally nor
 * scoped to an instance, which only happens before the app knows which instance it is on.
 */
export function readKey(instance: string, post: ReadKeySource): string | null {
  if (post.ap_id) return post.ap_id;
  if (!instance) return null;
  return `${instance}#${post.id}`;
}

export function isPostRead(instance: string, post: ReadKeySource): boolean {
  const key = readKey(instance, post);
  return key !== null && readIndex.has(key);
}

/**
 * Records a post as read. Called for signed-in and anonymous readers alike, and always
 * synchronously — the feed's filter reads this set on the next render, so the write must land
 * before the card would otherwise be re-shown.
 */
export function markPostRead(instance: string, post: ReadKeySource): void {
  const key = readKey(instance, post);
  if (key === null || readIndex.has(key)) return;
  readIndex.add(key);
  readKeys.push(key);
  if (readKeys.length > MAX_ENTRIES) {
    readKeys = readKeys.slice(readKeys.length - MAX_ENTRIES);
    readIndex = new Set(readKeys);
  }
  persist();
}

/** How many posts this device is currently holding out of the feed. */
export function readPostCount(): number {
  return readKeys.length;
}

/**
 * Forgets every read post on this device. The account-side read state on the Lemmy instance is
 * not touched — that belongs to the account and is not this module's to clear.
 */
export function clearReadPosts(): void {
  readKeys = [];
  readIndex = new Set<string>();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: the in-memory set is already cleared for this session.
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(readKeys));
    return;
  } catch {
    // A full quota is the one failure that would silently lose the newest key, so drop the older
    // half and retry once. If that also fails the set stays in memory for the session.
    readKeys = readKeys.slice(Math.floor(readKeys.length / 2));
    readIndex = new Set(readKeys);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(readKeys));
    } catch {
      // Session-only from here.
    }
  }
}