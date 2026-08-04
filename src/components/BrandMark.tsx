export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" aria-label="The Human Network">
      <img src="/hand.svg" alt="" className="h-9 w-9 rounded-[.7rem] shadow-soft" aria-hidden="true" />
      {!compact && <span className="max-w-[9rem] font-display text-xl leading-[.9] tracking-[-0.04em]">The Human Network</span>}
    </div>
  );
}
