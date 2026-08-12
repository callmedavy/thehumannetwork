import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, MessageSquare, PenLine, Sparkles } from "lucide-react";
import type { PostView } from "../types";
import { USER_POSTS_PAGE_SIZE, listUserPosts } from "../lib/lemmy";
import { compactNumber, postImage, relativeTime, titleGradient } from "../lib/format";
import { useAppStore } from "../store/useAppStore";
import { LoadingScreen } from "./LoadingScreen";

interface ProfilePostHistoryProps {
  personId?: number;
  onOpenPost: (post: PostView) => void;
}

export function ProfilePostHistory({ personId, onOpenPost }: ProfilePostHistoryProps) {
  const instance = useAppStore((state) => state.instance);
  const token = useAppStore((state) => state.token);
  const setView = useAppStore((state) => state.setView);
  const toast = useAppStore((state) => state.toast);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const page = useRef(1);

  const loadPosts = useCallback(async (reset = false) => {
    if (!personId) return;
    reset ? setLoading(true) : setLoadingMore(true);
    try {
      const nextPosts = await listUserPosts(instance, personId, reset ? 1 : page.current, token);
      setPosts((current) => reset ? nextPosts : [...current, ...nextPosts.filter((post) => !current.some((item) => item.post.id === post.post.id))]);
      page.current = (reset ? 1 : page.current) + 1;
      setExhausted(nextPosts.length < USER_POSTS_PAGE_SIZE);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not load your post history.", "error");
      if (reset) setPosts([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [instance, personId, token, toast]);

  useEffect(() => {
    page.current = 1;
    setPosts([]);
    setExhausted(false);
    void loadPosts(true);
  }, [loadPosts]);

  if (!personId) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-[.2em] text-muted">Published on {instance}</p>
          <h3 className="font-display text-3xl">Your posts</h3>
        </div>
        <button type="button" onClick={() => setView("publish")} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-panel px-3 py-2 text-xs font-extrabold" aria-label="Write a new post"><PenLine className="h-3.5 w-3.5" />New</button>
      </div>

      {loading ? (
        <LoadingScreen label="Loading your posts" className="min-h-[30dvh]" />
      ) : posts.length ? (
        <>
          <div className="mt-4 space-y-3">
            {posts.map((post) => {
              const image = postImage(post);
              return (
                <button key={post.post.id} type="button" onClick={() => onOpenPost(post)} className="flex w-full min-w-0 items-stretch gap-4 overflow-hidden rounded-2xl border border-line bg-panel p-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-card" aria-label={`Open ${post.post.name}`}>
                  <span className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-canvas sm:h-28 sm:w-32">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-end p-3" style={{ background: titleGradient(post.post.name) }}><Sparkles className="h-5 w-5 text-black/60" /></span>}</span>
                  <span className="flex min-w-0 flex-1 flex-col py-1"><span className="truncate text-[10px] font-extrabold uppercase tracking-[.12em] text-muted">!{post.community.name} · {relativeTime(post.post.published)}</span><strong className="mt-1 line-clamp-3 break-words text-sm leading-snug [overflow-wrap:anywhere] sm:text-base">{post.post.name}</strong><span className="mt-auto flex items-center gap-3 pt-2 text-xs font-bold text-muted"><span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-sprout" />{compactNumber(post.counts.score)} points</span><span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" />{compactNumber(post.counts.comments)}</span></span></span>
                </button>
              );
            })}
          </div>
          {!exhausted && <button type="button" onClick={() => void loadPosts()} disabled={loadingMore} className="mx-auto mt-6 flex min-w-36 items-center justify-center gap-2 rounded-xl border border-line bg-panel px-5 py-3 text-xs font-extrabold disabled:opacity-50">{loadingMore && <LoaderCircle className="h-4 w-4 animate-spin" />}Load more</button>}
        </>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-line bg-panel/60 p-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-canvas shadow-soft"><PenLine className="h-6 w-6 text-muted" /></span>
          <h4 className="mt-4 font-display text-2xl">Nothing published yet.</h4>
          <p className="mt-2 text-sm text-muted">Posts you publish to Lemmy show up here.</p>
          <button type="button" onClick={() => setView("publish")} className="mt-5 rounded-xl bg-ink px-5 py-3 text-xs font-extrabold text-panel">Write your first post</button>
        </div>
      )}
    </section>
  );
}
