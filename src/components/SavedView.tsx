import { useEffect, useState } from "react";
import { ArrowLeft, BookmarkX, Menu, Trash2 } from "lucide-react";
import type { PostView } from "../types";
import { listSavedPosts } from "../lib/lemmy";
import { postImage, titleGradient } from "../lib/format";
import { useAppStore } from "../store/useAppStore";
import { LoadingScreen } from "./LoadingScreen";

export function SavedView({ onOpenPost }: { onOpenPost: (post: PostView) => void }) {
  const instance = useAppStore((state) => state.instance);
  const token = useAppStore((state) => state.token);
  const removeSaved = useAppStore((state) => state.removeSaved);
  const setSavedIds = useAppStore((state) => state.setSavedIds);
  const setView = useAppStore((state) => state.setView);
  const setMenuOpen = useAppStore((state) => state.setMenuOpen);
  const toast = useAppStore((state) => state.toast);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedPosts() {
      if (!token) {
        setPosts([]);
        setSavedIds([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const savedPosts: PostView[] = [];
        let page = 1;
        while (true) {
          const pagePosts = await listSavedPosts(instance, page, token);
          savedPosts.push(...pagePosts.filter((post) => !savedPosts.some((saved) => saved.post.id === post.post.id)));
          if (pagePosts.length < 50) break;
          page += 1;
        }
        if (!cancelled) {
          setPosts(savedPosts);
          setSavedIds(savedPosts.map((post) => post.post.id));
        }
      } catch (error) {
        if (!cancelled) toast(error instanceof Error ? error.message : "Could not load saved posts from your instance.", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSavedPosts();
    return () => { cancelled = true; };
  }, [instance, token, setSavedIds, toast]);

  async function handleRemove(postId: number) {
    const removed = await removeSaved(postId);
    if (removed) setPosts((current) => current.filter((post) => post.post.id !== postId));
  }

  return (
    <main className="min-h-[100dvh]">
      <header className="safe-top sticky top-0 z-20 border-b border-line/70 bg-canvas/80 px-4 pb-3 backdrop-blur-xl"><div className="mx-auto flex max-w-3xl items-center justify-between"><button type="button" onClick={() => setView("feed")} className="rounded-full p-2.5 text-muted hover:bg-panel hover:text-ink" aria-label="Back to feed"><ArrowLeft className="h-5 w-5" /></button><div className="text-center"><p className="text-[9px] font-extrabold uppercase tracking-[.2em] text-muted">Synced from {instance}</p><h1 className="font-display text-2xl">Saved</h1></div><button type="button" onClick={() => setMenuOpen(true)} className="rounded-full p-2.5 text-muted hover:bg-panel hover:text-ink" aria-label="Open menu"><Menu className="h-5 w-5" /></button></div></header>
      <section className="mx-auto max-w-3xl px-4 py-6 safe-bottom">
        {posts.length > 0 && <div className="mb-4 flex items-center justify-between"><p className="text-xs font-bold text-muted">{posts.length} saved on Lemmy</p><button type="button" onClick={() => setEditing((value) => !value)} className="rounded-xl border border-line bg-panel px-3 py-2 text-xs font-extrabold">{editing ? "Done" : "Edit"}</button></div>}
        {loading ? <LoadingScreen label="Loading saved posts" className="min-h-[65dvh]" /> : posts.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{posts.map((post) => { const image = postImage(post); return <article key={post.post.id} className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-panel shadow-soft"><button type="button" onClick={() => editing ? void handleRemove(post.post.id) : onOpenPost(post)} className="h-full w-full text-left" aria-label={editing ? `Remove ${post.post.name} from saved posts` : `Open ${post.post.name}`}>{image ? <img src={image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-end p-4" style={{ background: titleGradient(post.post.name) }}><p className="font-display text-xl leading-tight text-black/80">{post.post.name}</p></div>}<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-10 text-white"><p className="line-clamp-2 text-xs font-extrabold leading-snug">{post.post.name}</p></div>{editing && <span className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-flare text-white shadow-soft"><Trash2 className="h-4 w-4" /></span>}</button></article>; })}</div>
        ) : <div className="grid min-h-[65dvh] place-items-center text-center"><div><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-panel shadow-soft"><BookmarkX className="h-7 w-7 text-muted" /></span><h2 className="mt-5 font-display text-3xl">Nothing saved on this instance.</h2><p className="mt-2 text-sm text-muted">Posts saved in Lemmy appear here automatically.</p><button type="button" onClick={() => setView("feed")} className="mt-5 rounded-xl bg-ink px-5 py-3 text-xs font-extrabold text-panel">Go to the feed</button></div></div>}
      </section>
    </main>
  );
}
