export function Logo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2.5">
        <svg viewBox="0 0 36 36" className="h-8 w-8" aria-hidden>
          <defs>
            <linearGradient id="usign-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="oklch(0.78 0.14 200)" />
              <stop offset="100%" stopColor="oklch(0.55 0.18 240)" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="32" height="32" rx="9" fill="url(#usign-grad)" />
          <path
            d="M11 11v9.5c0 3.6 2.9 6.5 7 6.5s7-2.9 7-6.5V11"
            stroke="white"
            strokeWidth="2.6"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="25.5" cy="25.5" r="2.4" fill="oklch(0.78 0.16 60)" />
        </svg>
        <div className="leading-none">
          <div className="text-base font-bold tracking-tight text-sidebar-foreground">Usign</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">
            e-signature
          </div>
        </div>
      </div>
    </div>
  );
}
