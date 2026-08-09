import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Menu, RotateCcw, SlidersHorizontal, Sparkles } from "lucide-react";
import type { Community, PostView, SwipeDirection } from "../types";
import { listPosts, votePost } from "../lib/lemmy";
import { crossPostKey } from "../lib/format";
import { useAppStore } from "../store/useAppStore";
import { BrandMark } from "./BrandMark";
import { SwipeCard } from "./SwipeCard";
import { ActionRail } from "./ActionRail";
import { LoadingScreen } from "./LoadingScreen";

export function FeedScreen({ onOpenPost, votedPostId }: { onOpenPost: (post: PostView) => void; votedPostId?: number | null }) {
  const instance = useAppStore((state) => state.instance);
  const token = useAppStore((state) => state.token);
  const filters = useAppStore((state) => state.filters);
  const readFilterMode = useAppStore((state) => state.readFilterMode);
  const sessionReady = useAppStore((state) => state.sessionReady);
  const collapseCrossPosts = useAppStore((state) => state.collapseCrossPosts);
  const localReadIds = useAppStore((state) => state.localReadIds);
  const setMenuOpen = useAppStore((state) => state.setMenuOpen);
  const setFilterOpen = useAppStore((state) => state.setFilterOpen);
  const syncSavedStatuses = useAppStore((state) => state.syncSavedStatuses);
  const markPostRead = useAppStore((state) => state.markPostRead);
  const haptics = useAppStore((state) => state.haptics);
  const toast = useAppStore((state) => state.toast);
  const [queue, setQueue] = useState<PostView[]>([]);
  const [crossPosts, setCrossPosts] = useState<Record<number, Community[]>>({});
  const [loading, setLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);
  const [fetchRevision, setFetchRevision] = useState(0);
  // Cursor pagination is the primary path; the page counter only serves pre-0.19 instances.
  const cursor = useRef<string | null>(null);
  const pageNumber = useRef(1);
  // Every post id already appended this session, so a re-ranked page cannot append it twice.
  const appendedIds = useRef(new Set<number>());
  const crossPostOwners = useRef(new Map<string, number>());
  const fetching = useRef(false);
  const generation = useRef(0);

  // A change to any of these makes the stored cursor meaningless, so the feed starts over.
  const scopeKey = `${instance}|${token ? "account" : "guest"}|${filters.scope}|${filters.order}|${filters.date}|${readFilterMode}`;

  // Render list and top-up trigger read from the same filtered queue: a post dismissed this
  // session, or already read on the server, is never rendered and never counts as depth.
  const visibleQueue = useMemo(
    () => queue.filter((post) => !localReadIds.has(post.post.id) && post.post.id !== votedPostId && !(readFilterMode === "client" && post.read)),
    [queue, localReadIds, votedPostId, readFilterMode],
  );
  const current = visibleQueue[0];

  const resetFeed = useCallback(() => {
    generation.current += 1;
    cursor.current = null;
    pageNumber.current = 1;
    appendedIds.current = new Set<number>();
    crossPostOwners.current = new Map<string, number>();
    setQueue([]);
    setCrossPosts({});
    setExhausted(false);
    setLoading(true);
  }, []);

  // The single point where posts enter feed state: dedupe, read filtering and optional
  // cross-post collapsing all happen here so no component has to repeat them.
  const ingestPosts = useCallback((incoming: PostView[]) => {
    const dismissed = useAppStore.getState().localReadIds;
    const fresh: PostView[] = [];
    const groupedCommunities: Array<[number, Community]> = [];

    incoming.forEach((post) => {
      const postId = post.post.id;
      if (appendedIds.current.has(postId)) return;
      if (dismissed.has(postId)) return;
      // In server mode the instance already omitted read posts; re-checking the flag here would
      // be a second opinion on the same question.
      if (readFilterMode === "client" && post.read) return;
      const hasVote = Boolean(token) && post.my_vote !== null && post.my_vote !== undefined && post.my_vote !== 0;
      if (hasVote) return;

      if (collapseCrossPosts) {
        const key = crossPostKey(post);
        const ownerId = key ? crossPostOwners.current.get(key) : undefined;
        if (key && ownerId !== undefined) {
          appendedIds.current.add(postId);
          groupedCommunities.push([ownerId, post.community]);
          return;
        }
        if (key) crossPostOwners.current.set(key, postId);
      }

      appendedIds.current.add(postId);
      fresh.push(post);
    });

    if (fresh.length) setQueue((current) => [...current, ...fresh]);
    if (groupedCommunities.length) {
      setCrossPosts((current) => {
        const next = { ...current };
        groupedCommunities.forEach(([ownerId, community]) => {
          const existing = next[ownerId] ?? [];
          if (!existing.some((item) => item.id === community.id)) next[ownerId] = [...existing, community];
        });
        return next;
      });
    }
  }, [collapseCrossPosts, readFilterMode, token]);

  const fetchPage = useCallback(async () => {
    // One request at a time. A call that arrives while another is settling is not lost: the
    // finally block bumps fetchRevision, which re-runs the effect below.
    if (fetching.current) return;
    fetching.current = true;
    const currentGeneration = generation.current;
    try {
      const page = await listPosts(instance, filters, {
        cursor: cursor.current,
        page: pageNumber.current,
        // Only one of the three read paths asks the server to filter.
        showRead: readFilterMode === "server" ? false : readFilterMode === "session" ? true : undefined,
      }, token);
      // The scope changed while this request was in flight; its posts and cursor belong to a
      // feed that no longer exists, so nothing here may reach feed state.
      if (generation.current !== currentGeneration) return;
      if (token) syncSavedStatuses(page.posts);
      cursor.current = page.nextCursor;
      pageNumber.current += 1;
      ingestPosts(page.posts);
      setExhausted(page.posts.length === 0 || (page.cursorPagination && !page.nextCursor));
    } catch (error) {
      if (generation.current !== currentGeneration) return;
      toast(error instanceof Error ? error.message : "Could not load the feed.", "error");
      setExhausted(true);
    } finally {
      if (generation.current === currentGeneration) setLoading(false);
      fetching.current = false;
      setFetchRevision((revision) => revision + 1);
    }
  }, [instance, filters, token, readFilterMode, toast, syncSavedStatuses, ingestPosts]);

  useEffect(() => {
    if (!sessionReady) return;
    resetFeed();
  }, [scopeKey, sessionReady, resetFeed]);

  // The only caller of fetchPage: the first page and every top-up go through here, so a single
  // response can never be appended by two different paths.
  useEffect(() => {
    if (!sessionReady || exhausted || fetching.current || visibleQueue.length > 8) return;
    void fetchPage();
  }, [visibleQueue.length, exhausted, sessionReady, fetchPage, fetchRevision]);

  useEffect(() => {
    if (votedPostId) markPostRead(votedPostId);
  }, [votedPostId, markPostRead]);

  function refresh() {
    resetFeed();
    setFetchRevision((revision) => revision + 1);
  }

  async function finalizeSwipe(direction: SwipeDirection) {
    const post = current;
    if (!post) return;
    if (direction !== "down" && !token) {
      toast("Sign in to vote.");
      return;
    }
    // Synchronous: the card is gone before mark_as_read leaves the browser.
    markPostRead(post.post.id);
    setQueue((currentQueue) => currentQueue.filter((item) => item.post.id !== post.post.id));
    if (haptics && "vibrate" in navigator) navigator.vibrate(10);

    if (direction === "down") return;

    try {
      await votePost(instance, post.post.id, direction === "right" ? 1 : -1, token!);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Vote failed.", "error");
    }
  }

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
            <SwipeCard key={post.post.id} post={post} alsoPostedIn={crossPosts[post.post.id]} depth={index} active={index === 0} canVote={Boolean(token)} onSwipe={finalizeSwipe} onOpen={() => onOpenPost(post)} />
          )).reverse() : (
            <div className="absolute inset-0 grid place-items-center rounded-[1.75rem] border border-dashed border-line bg-panel/60 p-8 text-center">
              <div><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-canvas"><Sparkles className="h-7 w-7 text-sprout" /></span><h2 className="mt-5 font-display text-3xl">You’re all caught up ✨</h2><p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">You reached the edge of this feed. Refresh it, or tune your filters for a different corner of the fediverse.</p><button type="button" onClick={refresh} className="mx-auto mt-5 flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-extrabold text-panel"><RotateCcw className="h-4 w-4" />Refresh feed</button></div>
            </div>
          )}
        </div>
        <div className="relative z-20 mt-5 shrink-0">
          {current && <ActionRail onAction={finalizeSwipe} onRead={() => finalizeSwipe("down")} canVote={Boolean(token)} />}
          <p className="mt-3 text-center text-[9px] font-bold uppercase tracking-[.18em] text-muted/70">Down marks read · left downvotes · right upvotes</p>
        </div>
      </div>
    </main>
  );
}
