import { ArrowDown, ArrowUp, Bookmark, Check } from "lucide-react";
import type { SwipeDirection } from "../types";

export function ActionRail({ onAction, onRead, onSave, saved, canVote }: { onAction: (direction: SwipeDirection) => void; onRead: () => void; onSave: () => void; saved: boolean; canVote: boolean }) {
  return (
    <div className="flex items-center justify-center gap-3" aria-label="Post actions">
      <button type="button" onClick={() => onAction("left")} disabled={!canVote} aria-label="Downvote" className="grid h-12 w-12 place-items-center rounded-full border border-line bg-panel text-flare shadow-soft transition hover:bg-flare hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-30">
        <ArrowDown className="h-5 w-5" />
      </button>
      <button type="button" onClick={onRead} aria-label="Mark post as read" className="grid h-12 w-12 place-items-center rounded-full border border-line bg-panel text-muted shadow-soft transition hover:bg-ink hover:text-panel active:scale-95">
        <Check className="h-5 w-5" />
      </button>
      <button type="button" onClick={onSave} disabled={!canVote} aria-label={saved ? "Remove bookmark" : "Bookmark post"} className={`grid h-12 w-12 place-items-center rounded-full border border-line shadow-soft transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 ${saved ? "bg-ink text-panel" : "bg-panel text-ink hover:bg-ink hover:text-panel"}`}>
        <Bookmark className={`h-5 w-5 ${saved ? "fill-current" : ""}`} />
      </button>
      <button type="button" onClick={() => onAction("right")} disabled={!canVote} aria-label="Upvote" className="grid h-12 w-12 place-items-center rounded-full border border-line bg-panel text-sprout shadow-soft transition hover:bg-sprout hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-30">
        <ArrowUp className="h-5 w-5" />
      </button>
    </div>
  );
}
