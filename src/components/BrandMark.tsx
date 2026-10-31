export function BrandMark({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-gold shadow-card">
        <svg viewBox="0 0 32 32" className="size-5" aria-hidden="true">
          <path d="M8 9l8 14 8-14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {!compact && (
        <div className="leading-tight">
          <p className="font-display text-[19px] font-medium tracking-tight text-ink">Valuation Journal</p>
          <p className="hidden text-[11px] text-muted sm:block">Personal DCF research workspace</p>
        </div>
      )}
    </div>
  );
}
