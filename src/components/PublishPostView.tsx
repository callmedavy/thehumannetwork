import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Check, ChevronDown, EyeOff, Link2, LoaderCircle, Menu, Send, ShieldCheck } from "lucide-react";
import { createPost, listPublishCommunities } from "../lib/lemmy";
import { useAppStore } from "../store/useAppStore";
import type { Community, PostView } from "../types";
import { BrandMark } from "./BrandMark";

interface PublishPostViewProps {
  onPublished: (post: PostView) => void;
}

type ContentRating = "sfw" | "nsfw" | null;

export function PublishPostView({ onPublished }: PublishPostViewProps) {
  const instance = useAppStore((state) => state.instance);
  const token = useAppStore((state) => state.token);
  const setMenuOpen = useAppStore((state) => state.setMenuOpen);
  const setView = useAppStore((state) => state.setView);
  const toast = useAppStore((state) => state.toast);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [communityId, setCommunityId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [rating, setRating] = useState<ContentRating>(null);
  const [loadingCommunities, setLoadingCommunities] = useState(true);
  const [communityError, setCommunityError] = useState("");
  const [formError, setFormError] = useState("");
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadCommunities() {
      if (!token) {
        setLoadingCommunities(false);
        return;
      }

      setLoadingCommunities(true);
      setCommunityError("");
      try {
        const nextCommunities = await listPublishCommunities(instance, token);
        if (!active) return;
        setCommunities(nextCommunities);
        if (nextCommunities.length === 1) setCommunityId(String(nextCommunities[0].id));
      } catch (error) {
        if (active) setCommunityError(error instanceof Error ? error.message : "Could not load communities.");
      } finally {
        if (active) setLoadingCommunities(false);
      }
    }

    loadCommunities();
    return () => { active = false; };
  }, [instance, token]);

  const selectedCommunity = useMemo(() => communities.find((community) => community.id === Number(communityId)), [communities, communityId]);
  const canPublish = Boolean(token && title.trim() && communityId && rating && !loadingCommunities && !publishing);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!token) {
      setFormError("Sign in before publishing a post.");
      return;
    }
    if (!title.trim() || !communityId) {
      setFormError("Add a title and choose a community.");
      return;
    }
    if (!rating) {
      setFormError("Choose SFW or NSFW before publishing.");
      return;
    }

    const normalizedUrl = url.trim();
    if (normalizedUrl) {
      try {
        const parsedUrl = new URL(normalizedUrl);
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") throw new Error();
      } catch {
        setFormError("Enter a complete link beginning with http:// or https://.");
        return;
      }
    }

    setPublishing(true);
    try {
      const response = await createPost(instance, {
        name: title.trim(),
        communityId: Number(communityId),
        body: body.trim() || undefined,
        url: normalizedUrl || undefined,
        nsfw: rating === "nsfw",
      }, token);
      toast(`Published to ${selectedCommunity?.title || "your community"}.`, "success");
      setView("feed");
      onPublished(response.post_view);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The post could not be published.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-canvas">
      <header className="safe-top sticky top-0 z-30 border-b border-line/70 bg-canvas/80 px-4 pb-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <button type="button" onClick={() => setView("feed")} className="rounded-full px-3 py-2 text-xs font-extrabold uppercase tracking-[.12em] text-muted transition hover:bg-panel hover:text-ink" aria-label="Return to feed">Cancel</button>
          <BrandMark compact />
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" className="rounded-full p-2.5 text-muted transition hover:bg-panel hover:text-ink"><Menu className="h-5 w-5" /></button>
        </div>
      </header>

      <div className="safe-bottom mx-auto w-full max-w-xl px-4 pb-10 pt-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
          <p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-sprout">Add to the network</p>
          <h1 className="mt-2 max-w-md font-display text-5xl leading-[.92] tracking-[-.035em]">Publish something <em>worth meeting.</em></h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted">Your post publishes directly to a community on {instance}. Nothing is stored by The Human Network.</p>
        </motion.div>

        <motion.form onSubmit={handleSubmit} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30, delay: .06 }} className="mt-8 space-y-5" noValidate>
          <label className="block rounded-[1.5rem] border border-line bg-panel p-5 shadow-soft focus-within:border-sprout/70">
            <span className="text-[10px] font-extrabold uppercase tracking-[.18em] text-muted">Community</span>
            <span className="relative mt-2 block">
              <select value={communityId} onChange={(event) => setCommunityId(event.target.value)} disabled={loadingCommunities || Boolean(communityError)} required className="w-full appearance-none bg-transparent py-2 pr-10 text-base font-extrabold text-ink outline-none disabled:opacity-50" aria-describedby={communityError ? "community-error" : undefined}>
                <option value="" className="bg-panel text-ink">{loadingCommunities ? "Loading communities…" : "Choose a community"}</option>
                {communities.map((community) => <option key={community.id} value={community.id} className="bg-panel text-ink">{community.title} · !{community.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            </span>
            {communityError && <span id="community-error" className="mt-2 flex items-start gap-2 text-xs font-semibold leading-5 text-flare"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{communityError}</span>}
            {!loadingCommunities && !communityError && communities.length === 0 && <span className="mt-2 block text-xs font-semibold text-flare">No local or subscribed communities are available for publishing.</span>}
          </label>

          <label className="block rounded-[1.5rem] border border-line bg-panel p-5 shadow-soft focus-within:border-sprout/70">
            <span className="flex items-center justify-between gap-3"><span className="text-[10px] font-extrabold uppercase tracking-[.18em] text-muted">Title</span><span className="text-[10px] font-bold text-muted">{title.length}/200</span></span>
            <textarea value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} rows={2} required placeholder="Give people a reason to pause" className="mt-3 w-full resize-none bg-transparent font-display text-3xl leading-tight text-ink outline-none placeholder:text-muted/45" />
          </label>

          <label className="block rounded-[1.5rem] border border-line bg-panel p-5 shadow-soft focus-within:border-sprout/70">
            <span className="text-[10px] font-extrabold uppercase tracking-[.18em] text-muted">Body <span className="normal-case tracking-normal">(optional)</span></span>
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={7} placeholder="Write the context, question, or story here…" className="mt-3 w-full resize-y bg-transparent text-sm leading-7 text-ink outline-none placeholder:text-muted/45" />
          </label>

          <label className="flex items-center gap-3 rounded-[1.5rem] border border-line bg-panel p-5 shadow-soft focus-within:border-sprout/70">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-canvas text-sprout"><Link2 className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1"><span className="block text-[10px] font-extrabold uppercase tracking-[.18em] text-muted">Link <span className="normal-case tracking-normal">(optional)</span></span><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" className="mt-1 w-full bg-transparent text-sm font-semibold text-ink outline-none placeholder:text-muted/45" /></span>
          </label>

          {formError && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-flare/35 bg-flare/10 p-4 text-sm font-semibold leading-6 text-flare"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />{formError}</div>}

          <fieldset>
            <legend className="text-[10px] font-extrabold uppercase tracking-[.2em] text-muted">Required · Is this post SFW or NSFW?</legend>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setRating("sfw")} aria-pressed={rating === "sfw"} className={`relative rounded-[1.35rem] border p-4 text-left transition active:scale-[.98] ${rating === "sfw" ? "border-sprout bg-sprout/10 text-ink" : "border-line bg-panel text-muted hover:border-sprout/50 hover:text-ink"}`}>
                <span className="flex items-center justify-between"><ShieldCheck className="h-5 w-5" />{rating === "sfw" && <span className="grid h-6 w-6 place-items-center rounded-full bg-sprout text-canvas"><Check className="h-3.5 w-3.5" /></span>}</span>
                <span className="mt-4 block text-sm font-extrabold">SFW</span><span className="mt-1 block text-[11px] font-semibold leading-4 opacity-70">Safe for general viewing</span>
              </button>
              <button type="button" onClick={() => setRating("nsfw")} aria-pressed={rating === "nsfw"} className={`relative rounded-[1.35rem] border p-4 text-left transition active:scale-[.98] ${rating === "nsfw" ? "border-flare bg-flare/10 text-ink" : "border-line bg-panel text-muted hover:border-flare/50 hover:text-ink"}`}>
                <span className="flex items-center justify-between"><EyeOff className="h-5 w-5" />{rating === "nsfw" && <span className="grid h-6 w-6 place-items-center rounded-full bg-flare text-canvas"><Check className="h-3.5 w-3.5" /></span>}</span>
                <span className="mt-4 block text-sm font-extrabold">NSFW</span><span className="mt-1 block text-[11px] font-semibold leading-4 opacity-70">Sensitive or adult content</span>
              </button>
            </div>
          </fieldset>

          <motion.button whileTap={canPublish ? { scale: .98 } : undefined} type="submit" disabled={!canPublish} className="flex w-full items-center justify-center gap-2 rounded-[1.35rem] bg-ink px-5 py-4 text-sm font-extrabold text-panel shadow-card transition disabled:cursor-not-allowed disabled:opacity-35">
            {publishing ? <><LoaderCircle className="h-5 w-5 animate-spin" />Publishing…</> : <><Send className="h-5 w-5" />Publish post</>}
          </motion.button>
          <p className="text-center text-[10px] font-bold uppercase tracking-[.14em] text-muted/70">Published under your Lemmy identity</p>
        </motion.form>
      </div>
    </main>
  );
}
