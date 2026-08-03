export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" aria-label="Swimmey">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-panel shadow-soft">
        <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="M7 9.5c5.2.2 8.1 2.8 9 7.8 1-5 3.9-7.6 9-7.8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M10 20.5c3.8 2.6 8.2 2.6 12 0" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </span>
      {!compact && <span className="font-display text-3xl tracking-[-0.04em]">Swimmey</span>}
    </div>
  );
}
