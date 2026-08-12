import { ArrowDown, ArrowUp } from "lucide-react";
import type { SwipeDirection } from "../types";

// `canMarkRead` covers signed-in read-marking. `canAdvance` is the anonymous fallback: the
// center button still moves the stack forward locally, it just does not touch the account.
export function ActionRail({
  onAction,
  onRead,
  canVote,
  canMarkRead,
  canAdvance = false,
}: {
  onAction: (direction: SwipeDirection) => void;
  onRead: () => void;
  canVote: boolean;
  canMarkRead: boolean;
  canAdvance?: boolean;
}) {
  const centerEnabled = canMarkRead || canAdvance;
  const centerLabel = canMarkRead ? "Mark Read" : "Next";
  const centerAria = canMarkRead
    ? "Mark post as read and show next post"
    : "Skip to next post";

  return (
    <div className="flex items-center justify-center gap-3" aria-label="Post actions">
      <button type="button" onClick={() => onAction("left")} disabled={!canVote} aria-label="Downvote" className="grid h-12 w-12 place-items-center rounded-full border border-line bg-panel text-flare shadow-soft transition hover:bg-flare hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-30">
        <ArrowDown className="h-5 w-5" />
      </button>
      <button type="button" onClick={onRead} disabled={!centerEnabled} aria-label={centerAria} className="h-12 rounded-full border border-line bg-panel px-5 text-xs font-extrabold text-muted shadow-soft transition hover:bg-ink hover:text-panel active:scale-95 disabled:cursor-not-allowed disabled:opacity-30">
        {centerLabel}
      </button>
      <button type="button" onClick={() => onAction("right")} disabled={!canVote} aria-label="Upvote" className="grid h-12 w-12 place-items-center rounded-full border border-line bg-panel text-sprout shadow-soft transition hover:bg-sprout hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-30">
        <ArrowUp className="h-5 w-5" />
      </button>
    </div>
  );
}
