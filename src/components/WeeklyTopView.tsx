import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, LoaderCircle, Menu, Trophy } from "lucide-react";
import type { PostView } from "../types";
import { WEEKLY_TOP_PAGE_SIZE, listWeeklyTopPosts } from "../lib/lemmy";
import { compactNumber, postImage, relativeTime, titleGradient } from "../lib/format";
import { WEEKLY_TOP_SIZE, WEEKLY_TOP_WEEKS_OFFERED, completedWeeks, formatWeekLabel, type WeekWindow } from "../lib/weeklyTop";
import { useAppStore } from "../store/useAppStore";
import { LoadingScreen } from "./LoadingScreen";

/** Which instances stood behind the chart, and which fell short of it. */
interface Coverage {
  sources: string[];
  capped: string[];
  interrupted: string[];
  silent: string[];
}

const EMPTY_COVERAGE: Coverage = { sources: [], capped: [], interrupted: [], silent: [] };

/**
 * Two stages in one screen: the picker (finished weeks, no network at all) and the chart for the
 * week the reader picked. Keeping them in one component is what makes the back arrow mean "up one
 * stage" instead of a round trip through the feed.
 */
export function WeeklyTopView({ onOpenPost }: { onOpenPost: (post: PostView) => void }) {
  const instance = useAppStore((state) => state.instance);
  const token = useAppStore((state) => state.token);
  const collapseCrossPosts = useAppStore((state) => state.collapseCrossPosts);
  const setView = useAppStore((state) => state.setView);
  const setMenuOpen = useAppStore((state) => state.setMenuOpen);
  const toast = useAppStore((state) => state.toast);
  // Built once per mount: the finished weeks are a fixed list, and it must not shift under the
  // reader's thumb because the app happened to sit open across midnight on a Saturday.
  const [weeks] = useState(() => completedWeeks(WEEKLY_TOP_WEEKS_OFFERED));
  const [selected, setSelected] = useState<WeekWindow | null>(null);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ pages: 0, sources: 0 });
  const [coverage, setCoverage] = useState<Coverage>(EMPTY_COVERAGE);
  // Weeks inside the last month answer on the first page; an older one takes a dozen and a half,
  // so picking a second week mid-flight must not land the first week's pages in the second chart.
  const generation = useRef(0);

  useEffect(() => () => { generation.current += 1; }, []);

  const openWeek = useCallback(async (week: WeekWindow) => {
    generation.current += 1;
    const mine = generation.current;
    setSelected(week);
    setPosts([]);
    setProgress({ pages: 0, sources: 0 });
    setCoverage(EMPTY_COVERAGE);
    setLoading(true);
    try {
      const result = await listWeeklyTopPosts(instance, week, {
        token,
        collapseCrossPosts,
        // Pages arrive over a few seconds for an older week, so the chart fills in as they land
        // rather than showing a spinner for the whole walk.
        onProgress: (running, walked) => {
          if (generation.current !== mine) return;
          setPosts(running);
          setProgress(walked);
        },
      });
      if (generation.current !== mine) return;
      setPosts(result.posts);
      setProgress({ pages: result.pagesScanned, sources: result.sources.length });
      setCoverage({ sources: result.sources, capped: result.capped, interrupted: result.interrupted, silent: result.silent });
    } catch (error) {
      if (generation.current !== mine) return;
      toast(error instanceof Error ? error.message : "Could not load that week's posts.", "error");
      setPosts([]);
    } finally {
      if (generation.current === mine) setLoading(false);
    }
  }, [instance, token, collapseCrossPosts, toast]);

  const backToWeeks = useCallback(() => {
    generation.current += 1;
    setSelected(null);
    setPosts([]);
    setLoading(false);
  }, []);

  const label = selected ? formatWeekLabel(selected) : "";
  const scanned = progress.pages * WEEKLY_TOP_PAGE_SIZE;
  const readCount = coverage.sources.length + coverage.silent.length;

  return (
    <main className="min-h-[100dvh]">
      <header className="safe-top sticky top-0 z-20 border-b border-line/70 bg-canvas/80 px-4 pb-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <button type="button" onClick={() => (selected ? backToWeeks() : setView("feed"))} className="rounded-full p-2.5 text-muted hover:bg-panel hover:text-ink" aria-label={selected ? "Back to the week list" : "Back to feed"}><ArrowLeft className="h-5 w-5" /></button>
          <div className="min-w-0 px-2 text-center"><p className="text-[9px] font-extrabold uppercase tracking-[.2em] text-muted">{selected ? "Weekly Top 10" : "Across the fediverse"}</p><h1 className={`font-display ${selected ? "text-xl sm:text-2xl" : "text-2xl"}`}>{selected ? label : "Weekly Top 10"}</h1></div>
          <button type="button" onClick={() => setMenuOpen(true)} className="rounded-full p-2.5 text-muted hover:bg-panel hover:text-ink" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
        </div>
      </header>

      {!selected && (
        <section className="mx-auto w-full max-w-3xl px-4 py-6 safe-bottom">
          <p className="mb-5 text-sm leading-relaxed text-muted">Weeks run Sunday to Saturday, in your own timezone. Nothing is fetched until you open one, and each chart is merged from your instance plus four large ones — no single instance sees the whole network.</p>
          <ul className="space-y-2">
            {weeks.map((week) => (
              <li key={week.key}>
                <button type="button" onClick={() => void openWeek(week)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-3.5 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-card" aria-label={`Show the top ten posts of ${formatWeekLabel(week)}`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-canvas"><Trophy className="h-4 w-4 text-sprout" /></span>
                  <strong className="min-w-0 flex-1 truncate text-sm font-extrabold">{formatWeekLabel(week)}</strong>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {selected && (
        <section className="mx-auto w-full max-w-3xl px-4 py-6 safe-bottom">
          {loading && !posts.length ? (
            <LoadingScreen label={`Ranking ${label}`} className="min-h-[65dvh]" />
          ) : posts.length ? (
            <>
              <ol className="space-y-2">
                {posts.map((post, index) => {
                  const image = postImage(post);
                  return (
                    <li key={post.post.id}>
                      <button type="button" onClick={() => onOpenPost(post)} className="flex w-full min-w-0 items-stretch gap-3 overflow-hidden rounded-2xl border border-line bg-panel p-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-card" aria-label={`Number ${index + 1} this week: open ${post.post.name}`}>
                        <span className={`w-7 shrink-0 pt-0.5 text-center font-display text-2xl leading-none ${index < 3 ? "text-sprout" : "text-muted"}`} aria-hidden="true">{index + 1}</span>
                        <span className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-canvas sm:h-24 sm:w-28">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-end p-2" style={{ background: titleGradient(post.post.name) }}><Trophy className="h-4 w-4 text-black/50" /></span>}</span>
                        <span className="flex min-w-0 flex-1 flex-col py-1"><span className="truncate text-[10px] font-extrabold uppercase tracking-[.12em] text-muted">!{post.community.name} · {relativeTime(post.post.published)}</span><strong className="mt-1 line-clamp-2 break-words text-sm leading-snug [overflow-wrap:anywhere] sm:text-base">{post.post.name}</strong><span className="mt-auto pt-2 text-xs font-bold text-muted"><strong className="text-ink">{compactNumber(post.counts.score)}</strong> points</span></span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              {loading && <p className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-muted"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Scanned {scanned} posts across {progress.sources} {progress.sources === 1 ? "instance" : "instances"}</p>}
              {!loading && posts.length < WEEKLY_TOP_SIZE && <p className="mt-4 text-center text-xs leading-relaxed text-muted">Only {posts.length} {posts.length === 1 ? "post" : "posts"} from this week turned up.</p>}
              {!loading && coverage.capped.length > 0 && <p className="mt-4 text-center text-xs leading-relaxed text-muted">The scan hit its limit on {coverage.capped.join(", ")} after {scanned} posts each, so a lower-scoring post from this week could sit below it.</p>}
              {!loading && coverage.interrupted.length > 0 && <p className="mt-4 text-center text-xs leading-relaxed text-muted">{coverage.interrupted.join(", ")} stopped answering partway through the scan.</p>}
              {!loading && coverage.silent.length > 0 && <p className="mt-4 text-center text-xs leading-relaxed text-muted">{coverage.silent.join(", ")} did not answer, so {coverage.sources.length} of {readCount} instances are counted here.</p>}
            </>
          ) : (
            <div className="grid min-h-[65dvh] place-items-center text-center"><div><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-panel shadow-soft"><Trophy className="h-7 w-7 text-muted" /></span><h2 className="mt-5 font-display text-3xl">Nothing ranked that week.</h2><p className="mt-2 text-sm text-muted">No post from {label} reached the top posts of the instances read.</p><button type="button" onClick={backToWeeks} className="mt-5 rounded-xl bg-ink px-5 py-3 text-xs font-extrabold text-panel">Back to the weeks</button></div></div>
          )}
        </section>
      )}
    </main>
  );
}
