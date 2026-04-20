export function Logo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
          <defs>
            <linearGradient id="gf" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="oklch(0.78 0.16 145)" />
              <stop offset="100%" stopColor="oklch(0.6 0.18 165)" />
            </linearGradient>
          </defs>
          <path
            d="M6 4h14l6 6v18a0 0 0 0 1 0 0H6a0 0 0 0 1 0 0V4z"
            fill="url(#gf)"
          />
          <path d="M14 16l3 3 6-6" stroke="white" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="leading-none">
          <div className="text-base font-semibold tracking-tight text-sidebar-foreground">Goodflag</div>
          <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">Community</div>
        </div>
      </div>
    </div>
  );
}
