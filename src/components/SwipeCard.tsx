import { useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { ArrowDown, ArrowUp, Bookmark, Check, Eye, MessageCircle, Share2 } from "lucide-react";
import type { PostView, SwipeDirection } from "../types";
import { communityHandle, compactNumber, postImage, publicPostUrl, relativeTime, titleGradient } from "../lib/format";
import { useAppStore } from "../store/useAppStore";

interface SwipeCardProps {
  post: PostView;
  depth: number;
  active: boolean;
  canVote: boolean;
  onSwipe: (direction: SwipeDirection) => void;
  onOpen: () => void;
}

export function SwipeCard({ post, depth, active, canVote, onSwipe, onOpen }: SwipeCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-400, 0, 400], [-15, 0, 15]);
  const rightGlow = useTransform(x, [0, 180], [0, 0.8]);
  const leftGlow = useTransform(x, [-180, 0], [0.8, 0]);
  const downGlow = useTransform(y, [0, 150], [0, 0.9]);
  const image = postImage(post);
  const savedIds = useAppStore((state) => state.savedIds);
  const toggleSaved = useAppStore((state) => state.toggleSaved);
  const instance = useAppStore((state) => state.instance);
  const toast = useAppStore((state) => state.toast);
  const isSaved = savedIds.includes(post.post.id);
  const dragged = useRef(false);
  const committing = useRef(false);
  const [nsfwVisible, setNsfwVisible] = useState(false);
  const [dragDirection, setDragDirection] = useState<SwipeDirection | null>(null);

  function handleDrag(offset: { x: number; y: number }) {
    const activationDistance = 10;
    if (Math.abs(offset.x) < activationDistance && Math.abs(offset.y) < activationDistance) {
      setDragDirection(null);
      return;
    }

    if (Math.abs(offset.y) > Math.abs(offset.x)) {
      setDragDirection(offset.y > activationDistance ? "down" : null);
      return;
    }

    setDragDirection(Math.abs(offset.x) >= activationDistance ? (offset.x > 0 ? "right" : "left") : null);
  }

  function commit(direction: SwipeDirection) {
    if (committing.current) return;
    committing.current = true;
    const animation = direction === "down"
      ? animate(y, window.innerHeight * 1.2, { duration: 0.28, ease: [0.32, 0.72, 0, 1] })
      : animate(x, direction === "right" ? window.innerWidth * 1.4 : -window.innerWidth * 1.4, { duration: 0.28, ease: [0.32, 0.72, 0, 1] });
    animation.then(() => onSwipe(direction));
  }

  function handleDragEnd(_: unknown, info: { offset: { x: number; y: number } }) {
    const horizontalThreshold = window.innerWidth * 0.35;
    const verticalThreshold = Math.min(window.innerHeight * 0.2, 160);
    if (info.offset.y > verticalThreshold && info.offset.y > Math.abs(info.offset.x)) commit("down");
    else if (info.offset.x > horizontalThreshold && canVote) commit("right");
    else if (info.offset.x < -horizontalThreshold && canVote) commit("left");
  }

  async function handleShare() {
    const url = publicPostUrl(instance, post);
    try {
      if (navigator.share) {
        await navigator.share({ title: post.post.name, url });
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast("Public post link copied.", "success");
        return;
      }
      window.prompt("Copy this public post link", url);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast("Could not share this post.", "error");
    }
  }

  const scale = 1 - depth * 0.035;
  const translateY = depth * 13;

  return (
    <motion.article
      layout
      style={{ x: active ? x : 0, y: active ? y : translateY, rotate: active ? rotate : 0, scale }}
      drag={active}
      dragDirectionLock
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.95}
      onDragStart={() => { dragged.current = true; }}
      onDrag={(_, info) => { handleDrag(info.offset); }}
      onDragEnd={(event, info) => {
        handleDragEnd(event, info);
        setDragDirection(null);
        window.setTimeout(() => { dragged.current = false; }, 0);
      }}
      onClick={() => { if (!dragged.current && active) onOpen(); }}
      animate={{ opacity: 1 }}
      initial={{ opacity: 0, scale: scale - 0.03, y: translateY + 18 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`absolute inset-0 overflow-hidden rounded-[1.75rem] border border-line bg-panel shadow-card ${active ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"}`}
      aria-label={`${post.post.name}. Swipe down to mark read.${canVote ? " Swipe right to upvote or left to downvote." : ""}`}
    >
      {active && (
        <>
          <motion.div style={{ opacity: rightGlow }} className="pointer-events-none absolute inset-0 z-30 rounded-[1.75rem] border-[3px] border-sprout shadow-[inset_0_0_80px_rgba(34,197,94,.28)]">
            {canVote && dragDirection === "right" && (
              <span className="absolute left-8 top-8 flex items-center gap-2 rounded-full bg-sprout px-4 py-2 text-xs font-extrabold uppercase tracking-[.16em] text-white shadow-soft"><ArrowUp className="h-4 w-4" /> Upvote</span>
            )}
          </motion.div>
          <motion.div style={{ opacity: leftGlow }} className="pointer-events-none absolute inset-0 z-30 rounded-[1.75rem] border-[3px] border-flare shadow-[inset_0_0_80px_rgba(239,68,68,.25)]">
            {canVote && dragDirection === "left" && (
              <span className="absolute right-8 top-8 flex items-center gap-2 rounded-full bg-flare px-4 py-2 text-xs font-extrabold uppercase tracking-[.16em] text-white shadow-soft"><ArrowDown className="h-4 w-4" /> Downvote</span>
            )}
          </motion.div>
          <motion.div style={{ opacity: downGlow }} className="pointer-events-none absolute inset-0 z-30 flex items-start justify-center rounded-[1.75rem] border-[3px] border-ink/70 bg-ink/10 pt-8 shadow-[inset_0_0_80px_rgb(var(--ink)/.2)]">
            {dragDirection === "down" && (
              <span className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-extrabold uppercase tracking-[.16em] text-panel shadow-soft"><Check className="h-4 w-4" /> Mark read</span>
            )}
          </motion.div>
        </>
      )}

      <header className="flex h-[13%] items-center gap-3 px-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-canvas text-xs font-extrabold uppercase text-muted">
          {post.creator.avatar ? <img src={post.creator.avatar} alt="" className="h-full w-full object-cover" /> : post.creator.name.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-extrabold">{communityHandle(post)}</p>
          <p className="truncate text-[11px] text-muted">@{post.creator.name} · {relativeTime(post.post.published)}</p>
        </div>
        <span className="rounded-full bg-canvas px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.16em] text-muted">{post.community.title}</span>
      </header>

      <div className="relative h-[59%] overflow-hidden bg-black">
        {image ? (
          <img src={image} alt="" draggable={false} className={`h-full w-full object-contain transition duration-500 ${post.post.nsfw && !nsfwVisible ? "blur-2xl" : ""}`} />
        ) : (
          <div className="flex h-full items-end p-6" style={{ background: titleGradient(post.post.name) }}>
            <p className="font-display text-[clamp(2rem,7vw,3.4rem)] leading-[.95] tracking-[-.04em] text-black/80">{post.post.name}</p>
          </div>
        )}
        {post.post.nsfw && !nsfwVisible && (
          <button type="button" onClick={(event) => { event.stopPropagation(); setNsfwVisible(true); }} className="absolute inset-0 z-10 grid place-items-center bg-black/25 text-white backdrop-blur-sm" aria-label="Reveal sensitive image">
            <span className="flex items-center gap-2 rounded-full bg-black/55 px-4 py-2 text-xs font-bold backdrop-blur-xl"><Eye className="h-4 w-4" /> Sensitive · tap to reveal</span>
          </button>
        )}
      </div>

      <div className="flex h-[28%] flex-col px-5 pb-4 pt-4">
        {image && <h2 className="line-clamp-3 text-[clamp(1.2rem,4.6vw,1.65rem)] font-extrabold leading-[1.08] tracking-[-.035em]">{post.post.name}</h2>}
        <div className="mt-auto flex items-center gap-5 text-xs font-bold text-muted">
          <span className="flex items-center gap-1.5"><ArrowUp className="h-4 w-4" /> {compactNumber(post.counts.score)}</span>
          <span className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4" /> {compactNumber(post.counts.comments)}</span>
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); void handleShare(); }}
            className="ml-auto rounded-full bg-canvas p-2 text-muted transition hover:text-ink"
            aria-label={`Share ${post.post.name}`}
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); toggleSaved(post.post.id); }}
            className={`rounded-full p-2 transition ${isSaved ? "bg-ink text-panel" : "bg-canvas text-muted hover:text-ink"}`}
            aria-label={isSaved ? "Remove bookmark" : "Bookmark post"}
          >
            <Bookmark className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
          </button>
        </div>
      </div>
    </motion.article>
  );
}
