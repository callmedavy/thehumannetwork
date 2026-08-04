import { useCallback, useEffect, useRef, useState } from "react";
import { Menu, RotateCcw, SlidersHorizontal, Sparkles } from "lucide-react";
import type { PostView, SwipeDirection } from "../types";
import { listPosts, votePost } from "../lib/lemmy";
import { useAppStore } from "../store/useAppStore";
import { BrandMark } from "./BrandMark";
import { SwipeCard } from "./SwipeCard";
import { ActionRail } from "./ActionRail";
import { LoadingScreen } from "./LoadingScreen";

export function FeedScreen({ onOpenPost, votedPostId }: { onOpenPost: (post: PostView) => void; votedPostId?: number | null }) {
  const instance = useAppStore((state) => state.instance);
  const token = useAppStore((state) => state.token);
  const filters = useAppStore((state) => state.filters);
  const setMenuOpen = useAppStore((state) => state.setMenuOpen);
  const setFilterOpen = useAppStore((state) => state.setFilterOpen);
  const savedIds = useAppStore((state) => state.savedIds);
  const toggleSaved = useAppStore((state) => state.toggleSaved);
  const syncSavedStatuses = useAppStore((state) => state.syncSavedStatuses);
  const markPostRead = useAppStore((state) => state.markPostRead);
  const haptics = useAppStore((state) => state.haptics);
  const toast = useAppStore((state) => state.toast);
  const [queue, setQueue] = useState<PostView[]>([]);
  const [loading, setLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);
  const [fetchRevision, setFetchRevision] = useState(0);
  const page = useRef(1);
  const fetching = useRef(false);
  const generation = useRef(0);

  const fetchPage = useCallback(async (reset = false) => {
    if (fetching.current) return;
    fetching.current = true;
    const currentGeneration = generation.current;
    if (reset) setLoading(true);
    try {
      const posts = await listPosts(instance, filters, reset ? 1 : page.current, token);
      if (generation.current !== currentGeneration) return;
      if (token) syncSavedStatuses(posts);
      const unvotedPosts = token ? posts.filter((post) => !post.my_vote) : posts;
      const readPostIds = new Set(useAppStore.getState().readPostIds);
      const unreadPosts = unvotedPosts.filter((post) => !readPostIds.has(post.post.id));
      setQueue((current) => reset ? unreadPosts : [...current, ...unreadPosts.filter((post) => !current.some((item) => item.post.id === post.post.id))]);
      page.current = (reset ? 1 : page.current) + 1;
      setExhausted(posts.length === 0);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not load the feed.", "error");
      if (reset) setQueue([]);
    } finally {
      fetching.current = false;
      setLoading(false);
      setFetchRevision((revision) => revision + 1);
    }
  }, [instance, filters, token, toast, syncSavedStatuses]);

  useEffect(() => {
    generation.current += 1;
    page.current = 1;
    setQueue([]);
    setExhausted(false);
    fetchPage(true);
  }, [instance, filters, token]);

  useEffect(() => {
    if (!loading && !exhausted && queue.length <= 8) fetchPage();
  }, [queue.length, loading, exhausted, fetchPage, fetchRevision]);

  useEffect(() => {
    if (votedPostId) {
      markPostRead(votedPostId);
      setQueue((current) => current.filter((post) => post.post.id !== votedPostId));
    }
  }, [votedPostId, markPostRead]);

  async function finalizeSwipe(direction: SwipeDirection) {
    const post = queue.find((item) => item.post.id !== votedPostId);
    if (!post) return;
    if (direction !== "down" && !token) {
      toast("Sign in to vote.");
      return;
    }
    markPostRead(post.post.id);
    setQueue((current) => current.filter((item) => item.post.id !== post.post.id));
    if (haptics && "vibrate" in navigator) navigator.vibrate(10);

    if (direction === "down") return;

    try {
      await votePost(instance, post.post.id, direction === "right" ? 1 : -1, token!);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Vote failed.", "error");
    }
  }

  const visibleQueue = votedPostId ? queue.filter((post) => post.post.id !== votedPostId) : queue;
  const current = visibleQueue[0];

  return (
    <main className="relative flex h-[100dvh] flex-col overflow-hidden">
      <header className="safe-top fixed inset-x-0 top-0 z-30 border-b border-line/70 bg-canvas/75 px-4 pb-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <div className="min-w-0"><p className="text-[9px] font-extrabold uppercase tracking-[.2em] text-muted">My Host</p><p className="max-w-[8rem] truncate text-[11px] font-extrabold uppercase tracking-[.12em]">{instance}</p></div>
          <BrandMark compact />
          <div className="flex items-center gap-1"><button type="button" onClick={() => setFilterOpen(true)} aria-label="Open feed filters" className="rounded-full p-2.5 text-muted hover:bg-panel hover:text-ink"><SlidersHorizontal className="h-5 w-5" /></button><button type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" className="rounded-full p-2.5 text-muted hover:bg-panel hover:text-ink"><Menu className="h-5 w-5" /></button></div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col overflow-hidden px-4 pb-5 pt-[5.8rem] safe-bottom">
        <div className="relative mx-auto min-h-0 w-full flex-1 max-w-[27rem]">
          {loading ? <LoadingScreen label="Loading feed" className="absolute inset-0" /> : current ? visibleQueue.slice(0, 3).map((post, index) => (
            <SwipeCard key={post.post.id} post={post} depth={index} active={index === 0} canVote={Boolean(token)} onSwipe={finalizeSwipe} onOpen={() => onOpenPost(post)} />
          )).reverse() : (
            <div className="absolute inset-0 grid place-items-center rounded-[1.75rem] border border-dashed border-line bg-panel/60 p-8 text-center">
              <div><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-canvas"><Sparkles className="h-7 w-7 text-sprout" /></span><h2 className="mt-5 font-display text-3xl">You’re all caught up ✨</h2><p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">You reached the edge of this feed. Refresh it, or tune your filters for a different corner of the fediverse.</p><button type="button" onClick={() => { page.current = 1; setExhausted(false); fetchPage(true); }} className="mx-auto mt-5 flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-extrabold text-panel"><RotateCcw className="h-4 w-4" />Refresh feed</button></div>
            </div>
          )}
        </div>
        <div className="relative z-20 mt-5 shrink-0">
          {current && <ActionRail onAction={finalizeSwipe} onRead={() => finalizeSwipe("down")} onSave={() => toggleSaved(current.post.id)} saved={savedIds.includes(current.post.id)} canVote={Boolean(token)} />}
          <p className="mt-3 text-center text-[9px] font-bold uppercase tracking-[.18em] text-muted/70">Down marks read · left downvotes · right upvotes</p>
        </div>
      </div>
    </main>
  );
}
