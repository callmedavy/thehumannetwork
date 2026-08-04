import { create } from "zustand";
import type { Filters, PostView, ThemePreference, ToastMessage, ViewName } from "../types";
import { isJwtCurrent, normalizeInstance } from "../lib/format";
import { savePost } from "../lib/lemmy";

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
const initialTheme: ThemePreference = storedTheme === "pink" || storedTheme === "blue" || storedTheme === "tan" ? storedTheme : "forest";

interface AppState {
  instance: string;
  token: string | null;
  browsing: boolean;
  initialized: boolean;
  savedIds: number[];
  filters: Filters;
  theme: ThemePreference;
  haptics: boolean;
  view: ViewName;
  menuOpen: boolean;
  filterOpen: boolean;
  toasts: ToastMessage[];
  hydrate: () => void;
  signIn: (instance: string, token: string) => void;
  browse: (instance: string) => void;
  logout: () => void;
  toggleSaved: (postId: number) => Promise<boolean>;
  removeSaved: (postId: number) => Promise<boolean>;
  setSavedIds: (postIds: number[]) => void;
  syncSavedStatuses: (posts: PostView[]) => void;
  setFilters: (filters: Filters) => void;
  setTheme: (theme: ThemePreference) => void;
  setHaptics: (enabled: boolean) => void;
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
  filters: initialFilters,
  theme: initialTheme,
  haptics: storage.get<boolean>("swimmey:haptics", true),
  view: "feed",
  menuOpen: false,
  filterOpen: false,
  toasts: [],
  hydrate: () => {
    const instance = normalizeInstance(storage.get("swimmey:instance", ""));
    const token = storage.get<string | null>("swimmey:jwt", null);
    const currentToken = isJwtCurrent(token) ? token : null;
    if (!currentToken) localStorage.removeItem("swimmey:jwt");
    localStorage.removeItem("swimmey:saved");
    set({ instance, token: currentToken, browsing: Boolean(instance && !currentToken), initialized: true });
  },
  signIn: (instance, token) => {
    const normalized = normalizeInstance(instance);
    storage.set("swimmey:instance", normalized);
    storage.set("swimmey:jwt", token);
    set({ instance: normalized, token, browsing: false, savedIds: [], view: "feed" });
  },
  browse: (instance) => {
    const normalized = normalizeInstance(instance || "lemmy.world");
    storage.set("swimmey:instance", normalized);
    localStorage.removeItem("swimmey:jwt");
    set({ instance: normalized, token: null, browsing: true, savedIds: [], view: "feed" });
  },
  logout: () => {
    localStorage.removeItem("swimmey:jwt");
    set({ token: null, browsing: false, instance: "", savedIds: [], view: "feed", menuOpen: false });
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
