import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import type { Filters } from "../types";
import { useAppStore } from "../store/useAppStore";

const orderOptions: Array<{ value: Filters["order"]; label: string }> = [
  { value: "top", label: "Most upvotes" },
  { value: "comments", label: "Most commented" },
  { value: "contested", label: "Most contested" },
];

const dateOptions: Array<{ value: Filters["date"]; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "Last week" },
  { value: "month", label: "Past month" },
  { value: "year", label: "Past year" },
  { value: "all", label: "All time" },
];

function Pill({ active, disabled, children, onClick }: { active: boolean; disabled?: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition ${active ? "border-ink bg-ink text-panel" : "border-line bg-canvas text-muted hover:text-ink"} disabled:cursor-not-allowed disabled:opacity-35`}>
      {active && <Check className="h-3.5 w-3.5" />}{children}
    </button>
  );
}

export function FilterSheet() {
  const open = useAppStore((state) => state.filterOpen);
  const setOpen = useAppStore((state) => state.setFilterOpen);
  const filters = useAppStore((state) => state.filters);
  const setFilters = useAppStore((state) => state.setFilters);
  const token = useAppStore((state) => state.token);
  const [draft, setDraft] = useState(filters);

  useEffect(() => { if (open) setDraft(filters); }, [open, filters]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="absolute inset-0 h-full w-full bg-black/35 backdrop-blur-sm" aria-label="Close filters" />
          <motion.section initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="safe-bottom absolute inset-x-0 bottom-0 mx-auto max-h-[88dvh] max-w-xl overflow-y-auto rounded-t-[2rem] border border-line bg-panel px-5 pb-5 pt-3 shadow-card" aria-modal="true" role="dialog" aria-labelledby="filter-title">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
            <div className="flex items-center justify-between">
              <div><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-muted">Tune the signal</p><h2 id="filter-title" className="font-display text-3xl">Feed filters</h2></div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-canvas p-2.5 text-muted hover:text-ink" aria-label="Close filters"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-7 space-y-7">
              <fieldset><legend className="mb-3 text-xs font-extrabold uppercase tracking-[.14em] text-muted">Scope</legend><div className="flex flex-wrap gap-2"><Pill active={draft.scope === "All"} onClick={() => setDraft({ ...draft, scope: "All" })}>Everything</Pill><Pill active={draft.scope === "Subscribed"} disabled={!token} onClick={() => setDraft({ ...draft, scope: "Subscribed" })}>Subscribed</Pill></div></fieldset>
              <fieldset><legend className="mb-3 text-xs font-extrabold uppercase tracking-[.14em] text-muted">Sort high to low</legend><div className="flex flex-wrap gap-2">{orderOptions.map((option) => <Pill key={option.value} active={draft.order === option.value} onClick={() => setDraft({ ...draft, order: option.value })}>{option.label}</Pill>)}</div></fieldset>
              <fieldset><legend className="mb-3 text-xs font-extrabold uppercase tracking-[.14em] text-muted">Date posted</legend><div className="flex flex-wrap gap-2">{dateOptions.map((option) => <Pill key={option.value} active={draft.date === option.value} onClick={() => setDraft({ ...draft, date: option.value })}>{option.label}</Pill>)}</div></fieldset>
            </div>
            <button type="button" onClick={() => setFilters(draft)} className="mt-8 h-14 w-full rounded-2xl bg-ink text-sm font-extrabold text-panel transition active:scale-[.98]">Apply to feed</button>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
