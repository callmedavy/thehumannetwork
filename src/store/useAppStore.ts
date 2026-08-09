import { create } from "zustand";
import type { Filters, PostView, ReadFilterMode, ThemePreference, ToastMessage, ViewName } from "../types";
import { isJwtCurrent, normalizeInstance } from "../lib/format";
import { getSiteSession, markPostRead as markPostReadRequest, savePost, supportsServerReadFilter } from "../lib/lemmy";

const storage = {
  // Client preferences and the Lemmy session stay browser-local; account data remains on Lemmy.
  get<T>(key: string, fallback: T): T {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : (JSON.parse(value) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

const storedFilters = storage.get<Partial<Filters>>("swimmey:filters", {});
const initialFilters: Filters = {
  scope: storedFilters.scope === "Subscribed" ? "Subscribed" : "All",
  order: storedFilters.order === "comments" || storedFilters.order === "contested" ? storedFilters.order : "top",
  date: storedFilters.date === "week" || storedFilters.date === "month" || storedFilters.date === "year" || storedFilters.date === "all" ? storedFilters.date : "today",
};

const storedTheme = storage.get<string>("swimmey:theme", "forest");
const initialTheme: ThemePreference = storedTheme === "pink" || storedTheme === "blue" || storedTheme === "tan" || storedTheme === "matrix" ? storedTheme : "forest";

// Read state belongs to the Lemmy account, so nothing about it is written to the browser.
// Earlier builds kept a per-instance read list; clear it out on the way past.
function purgeLegacyReadHistory() {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("swimmey:read-posts:"))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // A locked-down storage sandbox simply means there is nothing to purge.
  }
}

interface AppState {
  instance: string;
  token: string | null;
  browsing: boolean;
  initialized: boolean;
  savedIds: number[];
  // Session scratch: ids the reader dismissed in this session. Hides the post the instant it is
  // swiped so a feed fetch racing the mark_as_read write cannot bring it back.
  localReadIds: Set<number>;
  readFilterMode: ReadFilterMode;
  autoMarkFetched: boolean;
  sessionReady: boolean;
  collapseCrossPosts: boolean;
  filters: Filters;
  theme: ThemePreference;
  haptics: boolean;
  view: ViewName;
  menuOpen: boolean;
  filterOpen: boolean;
  toasts: ToastMessage[];
  hydrate: () => void;
  loadSession: () => Promise<void>;
  signIn: (instance: string, token: string) => void;
  browse: (instance: string) => void;
  logout: () => void;
  toggleSaved: (postId: number) => Promise<boolean>;
  removeSaved: (postId: number) => Promise<boolean>;
  setSavedIds: (postIds: number[]) => void;
  syncSavedStatuses: (posts: PostView[]) => void;
  markPostRead: (postId: number) => void;
  setFilters: (filters: Filters) => void;
  setTheme: (theme: ThemePreference) => void;
  setHaptics: (enabled: boolean) => void;
  setCollapseCrossPosts: (enabled: boolean) => void;
  setView: (view: ViewName) => void;
  setMenuOpen: (open: boolean) => void;
  setFilterOpen: (open: boolean) => void;
  toast: (message: string, tone?: ToastMessage["tone"]) => void;
  dismissToast: (id: number) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  instance: "",
  token: null,
  browsing: false,
  initialized: false,
  savedIds: [],
  localReadIds: new Set<number>(),
  readFilterMode: "client",
  autoMarkFetched: false,
  sessionReady: false,
  collapseCrossPosts: storage.get<boolean>("swimmey:collapse-crossposts", false),
  filters: initialFilters,
  theme: initialTheme,
  haptics: storage.get<boolean>("swimmey:haptics", true),
  view: "feed",
  menuOpen: false,
  filterOpen: false,
  toasts: [],
  hydrate: () => {
    purgeLegacyReadHistory();
    const instance = normalizeInstance(storage.get("swimmey:instance", ""));
    const token = storage.get<string | null>("swimmey:jwt", null);
    const currentToken = isJwtCurrent(token) ? token : null;
    if (!currentToken) localStorage.removeItem("swimmey:jwt");
    localStorage.removeItem("swimmey:saved");
    set({ instance, token: currentToken, browsing: Boolean(instance && !currentToken), initialized: true });
  },
  loadSession: async () => {
    const { instance, token } = get();
    if (!instance) return;
    try {
      const session = await getSiteSession(instance, token);
      // Auto-marking plus server-side read filtering makes every fetched page instantly read,
      // which drains the feed while the reader is still looking at it.
      const autoMarkFetched = Boolean(token) && session.autoMarkFetchedPostsAsRead;
      if (autoMarkFetched) {
        console.warn(
          "[the-human-network] Your Lemmy account has auto_mark_fetched_posts_as_read enabled. Server-side read filtering is disabled to keep the feed from emptying itself; disable that account setting for the best swipe experience.",
        );
      }
      const readFilterMode: ReadFilterMode = autoMarkFetched
        ? "session"
        : token && supportsServerReadFilter(session.version)
          ? "server"
          : "client";
      set({ readFilterMode, autoMarkFetched, sessionReady: true });
    } catch {
      // Capability probing is best effort; the client-side path works everywhere.
      set({ readFilterMode: "client", autoMarkFetched: false, sessionReady: true });
    }
  },
  signIn: (instance, token) => {
    const normalized = normalizeInstance(instance);
    storage.set("swimmey:instance", normalized);
    storage.set("swimmey:jwt", token);
    set({ instance: normalized, token, browsing: false, savedIds: [], localReadIds: new Set<number>(), readFilterMode: "client", autoMarkFetched: false, sessionReady: false, view: "feed" });
  },
  browse: (instance) => {
    const normalized = normalizeInstance(instance || "lemmy.world");
    storage.set("swimmey:instance", normalized);
    localStorage.removeItem("swimmey:jwt");
    set({ instance: normalized, token: null, browsing: true, savedIds: [], localReadIds: new Set<number>(), readFilterMode: "client", autoMarkFetched: false, sessionReady: false, view: "feed" });
  },
  logout: () => {
    localStorage.removeItem("swimmey:jwt");
    set({ token: null, browsing: false, instance: "", savedIds: [], localReadIds: new Set<number>(), readFilterMode: "client", autoMarkFetched: false, sessionReady: false, view: "feed", menuOpen: false });
  },
  toggleSaved: async (postId) => {
    if (!get().token) {
      get().toast("Sign in to save posts.", "neutral");
      return false;
    }
    const wasSaved = get().savedIds.includes(postId);
    const optimisticIds = wasSaved ? get().savedIds.filter((id) => id !== postId) : [postId, ...get().savedIds];
    set({ savedIds: optimisticIds });
    try {
      const response = await savePost(get().instance, postId, !wasSaved, get().token!);
      const saved = response.post_view.saved ?? !wasSaved;
      set((state) => ({ savedIds: saved ? [postId, ...state.savedIds.filter((id) => id !== postId)] : state.savedIds.filter((id) => id !== postId) }));
      return saved;
    } catch (error) {
      set((state) => ({ savedIds: wasSaved ? [postId, ...state.savedIds.filter((id) => id !== postId)] : state.savedIds.filter((id) => id !== postId) }));
      get().toast(error instanceof Error ? error.message : "Could not update the saved post.", "error");
      return wasSaved;
    }
  },
  removeSaved: async (postId) => {
    if (!get().token) return false;
    const previousIds = get().savedIds;
    set({ savedIds: previousIds.filter((id) => id !== postId) });
    try {
      await savePost(get().instance, postId, false, get().token!);
      return true;
    } catch (error) {
      set({ savedIds: previousIds });
      get().toast(error instanceof Error ? error.message : "Could not remove the saved post.", "error");
      return false;
    }
  },
  setSavedIds: (savedIds) => set({ savedIds: Array.from(new Set(savedIds)) }),
  syncSavedStatuses: (posts) => set((state) => {
    const savedIds = new Set(state.savedIds);
    posts.forEach((post) => { if (post.saved) savedIds.add(post.post.id); else savedIds.delete(post.post.id); });
    return { savedIds: Array.from(savedIds) };
  }),
  markPostRead: (postId) => {
    const { localReadIds, instance, token } = get();
    if (localReadIds.has(postId)) return;
    // Hide first, write second. The next feed fetch can outrun mark_as_read, and the reader
    // should never see a card they already dismissed come back mid-scroll.
    set({ localReadIds: new Set(localReadIds).add(postId) });
    if (!token) return;
    void markPostReadRequest(instance, postId, token).catch((error) => {
      console.warn(`[the-human-network] Could not mark post ${postId} as read on ${instance}.`, error);
    });
  },
  setFilters: (filters) => {
    storage.set("swimmey:filters", filters);
    set({ filters, filterOpen: false });
  },
  setTheme: (theme) => {
    storage.set("swimmey:theme", theme);
    set({ theme });
  },
  setHaptics: (haptics) => {
    storage.set("swimmey:haptics", haptics);
    set({ haptics });
  },
  setCollapseCrossPosts: (collapseCrossPosts) => {
    storage.set("swimmey:collapse-crossposts", collapseCrossPosts);
    set({ collapseCrossPosts });
  },
  setView: (view) => set({ view, menuOpen: false }),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  setFilterOpen: (filterOpen) => set({ filterOpen }),
  toast: (message, tone = "neutral") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }));
    window.setTimeout(() => get().dismissToast(id), 3500);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
