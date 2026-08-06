import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Bell, Bookmark, CircleUserRound, Home, Info, LogOut, MoonStar, Settings, SquarePen, X } from "lucide-react";
import type { ViewName } from "../types";
import { BrandMark } from "./BrandMark";
import { useAppStore } from "../store/useAppStore";

const items: Array<{ view: ViewName; label: string; icon: typeof Home; requiresAuth?: boolean; authMessage?: string }> = [
  { view: "feed", label: "Feed", icon: Home },
  { view: "publish", label: "Publish post", icon: SquarePen, requiresAuth: true, authMessage: "Sign in to publish a post." },
  { view: "notifications", label: "Notifications", icon: Bell, requiresAuth: true },
  { view: "saved", label: "Saved", icon: Bookmark, requiresAuth: true },
  { view: "upvoted", label: "Upvoted", icon: ArrowUp, requiresAuth: true },
  { view: "downvoted", label: "Downvoted", icon: ArrowDown, requiresAuth: true },
  { view: "profile", label: "Profile", icon: CircleUserRound },
  { view: "settings", label: "Settings", icon: Settings },
  { view: "about", label: "About", icon: Info },
];

export function MenuDrawer() {
  const open = useAppStore((state) => state.menuOpen);
  const setOpen = useAppStore((state) => state.setMenuOpen);
  const view = useAppStore((state) => state.view);
  const setView = useAppStore((state) => state.setView);
  const instance = useAppStore((state) => state.instance);
  const token = useAppStore((state) => state.token);
  const logout = useAppStore((state) => state.logout);
  const toast = useAppStore((state) => state.toast);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="absolute inset-0 h-full w-full bg-black/35 backdrop-blur-sm" aria-label="Close menu" />
          <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="safe-top safe-bottom absolute bottom-0 right-0 top-0 flex min-h-0 w-[84%] max-w-sm flex-col overflow-hidden border-l border-line bg-panel p-5 shadow-card" aria-modal="true" role="dialog" aria-label="Navigation menu">
            <div className="flex items-center justify-between"><BrandMark /><button type="button" onClick={() => setOpen(false)} className="rounded-full bg-canvas p-2.5 text-muted hover:text-ink" aria-label="Close menu"><X className="h-5 w-5" /></button></div>
            <p className="mt-8 text-[10px] font-extrabold uppercase tracking-[.2em] text-muted">Connected to</p>
            <p className="mt-1 truncate text-sm font-extrabold uppercase tracking-[.12em]">{instance}</p>
            <nav className="hide-scrollbar mt-6 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
              {items.map(({ view: itemView, label, icon: Icon, requiresAuth, authMessage }) => (
                <button key={itemView} type="button" onClick={() => { if (requiresAuth && !token) toast(authMessage || (itemView === "notifications" ? "Sign in to view your notifications." : itemView === "saved" ? "Sign in to view your saved posts." : "Sign in to view your voting history.")); else setView(itemView); }} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-sm font-bold transition ${view === itemView ? "bg-ink text-panel" : "text-muted hover:bg-canvas hover:text-ink"}`} aria-label={requiresAuth && !token ? `${label}, sign in required` : label}><Icon className="h-5 w-5" />{label}{requiresAuth && !token && <span className="ml-auto text-[9px] font-extrabold uppercase tracking-[.12em] opacity-60">Sign in</span>}</button>
              ))}
            </nav>
            <div className="mt-4 shrink-0 rounded-2xl bg-canvas p-4">
              <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-panel"><MoonStar className="h-4 w-4" /></span><div><p className="text-sm font-extrabold">{token ? "Signed in" : "Read-only mode"}</p><p className="text-xs text-muted">{token ? "Voting and saves enabled" : "Browse without leaving a trace"}</p></div></div>
              <button type="button" onClick={logout} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-panel py-2.5 text-xs font-extrabold text-muted transition hover:text-flare"><LogOut className="h-4 w-4" /> {token ? "Log out" : "Change instance"}</button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
