import { ArrowDown, ArrowUp } from "lucide-react";
import type { SwipeDirection } from "../types";

export function ActionRail({ onAction, onRead, canVote }: { onAction: (direction: SwipeDirection) => void; onRead: () => void; canVote: boolean }) {
  return (
    <div className="flex items-center justify-center gap-3" aria-label="Post actions">
      <button type="button" onClick={() => onAction("left")} disabled={!canVote} aria-label="Downvote" className="grid h-12 w-12 place-items-center rounded-full border border-line bg-panel text-flare shadow-soft transition hover:bg-flare hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-30">
        <ArrowDown className="h-5 w-5" />
      </button>
      <button type="button" onClick={onRead} aria-label="Mark post as read and show next post" className="h-12 rounded-full border border-line bg-panel px-5 text-xs font-extrabold text-muted shadow-soft transition hover:bg-ink hover:text-panel active:scale-95">
        Mark Read
      </button>
      <button type="button" onClick={() => onAction("right")} disabled={!canVote} aria-label="Upvote" className="grid h-12 w-12 place-items-center rounded-full border border-line bg-panel text-sprout shadow-soft transition hover:bg-sprout hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-30">
        <ArrowUp className="h-5 w-5" />
      </button>
    </div>
  );
}
