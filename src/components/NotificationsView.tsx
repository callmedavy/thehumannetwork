import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, AtSign, Bell, LoaderCircle, Mail, Menu, MessageCircle, MoveUpRight } from "lucide-react";
import type { AccountNotification, PostView } from "../types";
import { getPost, listNotifications } from "../lib/lemmy";
import { relativeTime } from "../lib/format";
import { useAppStore } from "../store/useAppStore";
import { LoadingScreen } from "./LoadingScreen";

interface NotificationsViewProps {
  onOpenPost: (post: PostView) => void;
}

const labels = {
  reply: "Replied to you",
  mention: "Mentioned you",
  message: "Sent a private message",
};

const icons = {
  reply: MessageCircle,
  mention: AtSign,
  message: Mail,
};

export function NotificationsView({ onOpenPost }: NotificationsViewProps) {
  const instance = useAppStore((state) => state.instance);
  const token = useAppStore((state) => state.token);
  const setView = useAppStore((state) => state.setView);
  const setMenuOpen = useAppStore((state) => state.setMenuOpen);
  const [notifications, setNotifications] = useState<AccountNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openingPostId, setOpeningPostId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    listNotifications(instance, token)
      .then((items) => { if (active) setNotifications(items); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load notifications."); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [instance, refreshKey, token]);

  async function openPost(notification: AccountNotification) {
    if (!notification.post || !token || openingPostId) return;
    setOpeningPostId(notification.post.id);
    try {
      onOpenPost(await getPost(instance, notification.post.id, token));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open this post.");
    } finally {
      setOpeningPostId(null);
    }
  }

  return (
    <main className="min-h-[100dvh]">
      <header className="safe-top sticky top-0 z-20 border-b border-line/70 bg-canvas/80 px-4 pb-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <button type="button" onClick={() => setView("feed")} className="rounded-full p-2.5 text-muted transition hover:bg-panel hover:text-ink" aria-label="Back to feed"><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="font-display text-2xl">Notifications</h1>
          <button type="button" onClick={() => setMenuOpen(true)} className="rounded-full p-2.5 text-muted transition hover:bg-panel hover:text-ink" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
        </div>
      </header>

      <section className="mx-auto max-w-xl px-5 py-7 safe-bottom">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-sprout">From your Lemmy account</p><h2 className="mt-1 font-display text-4xl leading-none">What found you.</h2></div>
          {!loading && !error && <span className="rounded-full border border-line bg-panel px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-muted">{notifications.length} items</span>}
        </div>

        {loading && <LoadingScreen label="Loading notifications" className="py-16" />}
        {!loading && error && <div role="alert" className="rounded-[1.5rem] border border-flare/35 bg-panel p-5"><p className="text-sm font-extrabold text-flare">Notifications stayed out of reach.</p><p className="mt-2 text-xs leading-6 text-muted">{error}</p><button type="button" onClick={() => setRefreshKey((key) => key + 1)} className="mt-4 rounded-xl bg-canvas px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-ink">Try again</button></div>}
        {!loading && !error && notifications.length === 0 && <div className="rounded-[2rem] border border-line bg-panel px-6 py-12 text-center shadow-soft"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-canvas text-sprout"><Bell className="h-6 w-6" /></span><h3 className="mt-5 font-display text-3xl">All quiet.</h3><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted">Replies, mentions, and private messages from your account appear here.</p></div>}

        {!loading && !error && notifications.length > 0 && <div className="space-y-3">
          {notifications.map((notification, index) => {
            const Icon = icons[notification.kind];
            const canOpen = Boolean(notification.post);
            const opening = notification.post?.id === openingPostId;
            return <motion.article key={notification.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.035, 0.3), type: "spring", stiffness: 300, damping: 30 }} className={`relative overflow-hidden rounded-[1.5rem] border bg-panel p-4 shadow-soft ${notification.read ? "border-line" : "border-sprout/45"}`}>
              {!notification.read && <span className="absolute right-4 top-4 h-2 w-2 rounded-full bg-sprout" aria-label="Unread" />}
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-canvas text-[10px] font-extrabold uppercase text-muted">{notification.creator.avatar ? <img src={notification.creator.avatar} alt="" className="h-full w-full object-cover" /> : notification.creator.name.slice(0, 2)}</div>
                <div className="min-w-0 flex-1 pr-3"><div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]"><strong className="truncate text-ink">@{notification.creator.name}</strong><span className="flex items-center gap-1 text-muted"><Icon className="h-3 w-3" />{labels[notification.kind]}</span><span className="text-muted">{relativeTime(notification.published)}</span></div><p className="mt-2 line-clamp-4 whitespace-pre-wrap break-words text-sm leading-6 text-ink/85">{notification.content}</p>{notification.post && <p className="mt-3 truncate text-[11px] font-bold text-muted">On “{notification.post.name}”{notification.community ? ` in !${notification.community.name}` : ""}</p>}</div>
              </div>
              {canOpen && <button type="button" onClick={() => openPost(notification)} disabled={Boolean(openingPostId)} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-canvas text-[10px] font-extrabold uppercase tracking-[.12em] text-muted transition hover:text-ink disabled:opacity-45" aria-label={`Open post ${notification.post?.name}`}>{opening ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MoveUpRight className="h-4 w-4" />}Open conversation</button>}
            </motion.article>;
          })}
        </div>}
      </section>
    </main>
  );
}
