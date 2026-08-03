import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, LoaderCircle, Menu } from "lucide-react";
import type { PostView } from "../types";
import { listVotedPosts } from "../lib/lemmy";
import { compactNumber, postImage, relativeTime, titleGradient } from "../lib/format";
import { useAppStore } from "../store/useAppStore";
import { LoadingScreen } from "./LoadingScreen";

interface VoteHistoryViewProps {
  vote: "up" | "down";
  onOpenPost: (post: PostView) => void;
}

export function VoteHistoryView({ vote, onOpenPost }: VoteHistoryViewProps) {
  const instance = useAppStore((state) => state.instance);
  const token = useAppStore((state) => state.token);
  const setView = useAppStore((state) => state.setView);
  const setMenuOpen = useAppStore((state) => state.setMenuOpen);
  const toast = useAppStore((state) => state.toast);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const page = useRef(1);
  const isUpvoted = vote === "up";

  const loadPosts = useCallback(async (reset = false) => {
    if (!token) return;
    reset ? setLoading(true) : setLoadingMore(true);
    try {
      const nextPosts = await listVotedPosts(instance, vote, reset ? 1 : page.current, token);
      setPosts((current) => reset ? nextPosts : [...current, ...nextPosts.filter((post) => !current.some((item) => item.post.id === post.post.id))]);
      page.current = (reset ? 1 : page.current) + 1;
      setExhausted(nextPosts.length < 20);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not load voting history.", "error");
      if (reset) setPosts([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [instance, token, toast, vote]);

  useEffect(() => {
    page.current = 1;
    setPosts([]);
    setExhausted(false);
    void loadPosts(true);
  }, [loadPosts]);

  const Icon = isUpvoted ? ArrowUp : ArrowDown;
  const title = isUpvoted ? "Upvoted" : "Downvoted";
  const emptyCopy = isUpvoted ? "Posts you upvote collect here." : "Posts you downvote collect here.";

  return (
    <main className="min-h-[100dvh] overflow-x-hidden">
      <header className="safe-top sticky top-0 z-20 border-b border-line/70 bg-canvas/80 px-4 pb-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <button type="button" onClick={() => setView("feed")} className="rounded-full p-2.5 text-muted hover:bg-panel hover:text-ink" aria-label="Back to feed"><ArrowLeft className="h-5 w-5" /></button>
          <div className="text-center"><p className="text-[9px] font-extrabold uppercase tracking-[.2em] text-muted">Voting history</p><h1 className="font-display text-2xl">{title}</h1></div>
          <button type="button" onClick={() => setMenuOpen(true)} className="rounded-full p-2.5 text-muted hover:bg-panel hover:text-ink" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
        </div>
      </header>

      <section className="mx-auto w-full max-w-3xl px-4 py-6 safe-bottom">
        {loading ? (
          <LoadingScreen label={`Loading ${title.toLowerCase()} posts`} className="min-h-[65dvh]" />
        ) : posts.length ? (
          <>
            <div className="space-y-3">
              {posts.map((post) => {
                const image = postImage(post);
                return (
                  <button key={post.post.id} type="button" onClick={() => onOpenPost(post)} className="flex w-full min-w-0 items-stretch gap-4 overflow-hidden rounded-2xl border border-line bg-panel p-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-card" aria-label={`Open ${post.post.name}`}>
                    <span className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-canvas sm:h-28 sm:w-32">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-end p-3" style={{ background: titleGradient(post.post.name) }}><Icon className="h-5 w-5 text-black/60" /></span>}</span>
                    <span className="flex min-w-0 flex-1 flex-col py-1"><span className="truncate text-[10px] font-extrabold uppercase tracking-[.12em] text-muted">!{post.community.name} · {relativeTime(post.post.published)}</span><strong className="mt-1 line-clamp-3 break-words text-sm leading-snug [overflow-wrap:anywhere] sm:text-base">{post.post.name}</strong><span className="mt-auto flex items-center gap-1.5 pt-2 text-xs font-bold text-muted"><Icon className={`h-3.5 w-3.5 ${isUpvoted ? "text-sprout" : "text-flare"}`} />{compactNumber(post.counts.score)} points</span></span>
                  </button>
                );
              })}
            </div>
            {!exhausted && <button type="button" onClick={() => void loadPosts()} disabled={loadingMore} className="mx-auto mt-6 flex min-w-36 items-center justify-center gap-2 rounded-xl border border-line bg-panel px-5 py-3 text-xs font-extrabold disabled:opacity-50">{loadingMore && <LoaderCircle className="h-4 w-4 animate-spin" />}Load more</button>}
          </>
        ) : (
          <div className="grid min-h-[65dvh] place-items-center text-center"><div><span className={`mx-auto grid h-16 w-16 place-items-center rounded-full bg-panel shadow-soft ${isUpvoted ? "text-sprout" : "text-flare"}`}><Icon className="h-7 w-7" /></span><h2 className="mt-5 font-display text-3xl">No {title.toLowerCase()} posts yet.</h2><p className="mt-2 text-sm text-muted">{emptyCopy}</p><button type="button" onClick={() => setView("feed")} className="mt-5 rounded-xl bg-ink px-5 py-3 text-xs font-extrabold text-panel">Return to the feed</button></div></div>
        )}
      </section>
    </main>
  );
}
