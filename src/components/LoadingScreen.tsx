export function LoadingScreen({ label = "Loading", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`grid place-items-center ${className}`} role="status" aria-live="polite" aria-label={label}>
      <img
        src="/loading.gif"
        alt=""
        className="w-full max-w-lg rounded-[1.75rem] object-contain shadow-card"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
