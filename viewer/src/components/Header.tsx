/** Shapes from Shu's supplied SVGs; all paints come from the shared theme. */
export function Header() {
  return <header className="mountain-header">
    <svg className="mountain-art" viewBox="0 0 1440 150" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="ridge" x2="0" y2="1"><stop stopColor="var(--border)"/><stop offset="1" stopColor="var(--bg)"/></linearGradient><linearGradient id="foothills" x2="0" y2="1"><stop stopColor="var(--surface-2)"/><stop offset="1" stopColor="var(--bg)"/></linearGradient></defs>
      <path d="M380 150 L560 70 L640 95 L760 20 L840 60 L900 40 L1010 95 L1120 55 L1260 110 L1440 70 L1440 150Z" fill="url(#ridge)"/>
      <path d="M760 20 L780 45 L770 60 L800 52 L840 60 L800 40Z" fill="var(--text-3)" opacity=".2"/>
      <path d="M300 150 L520 110 L700 125 L860 90 L1000 130 L1200 100 L1440 135 L1440 150Z" fill="url(#foothills)"/>
    </svg>
    <div className="brand">
      <svg className="brand-mark" viewBox="0 0 64 64" width="56" height="56" aria-hidden="true"><path d="M32 4 L58 14 V32 C58 48 46 58 32 62 C18 58 6 48 6 32 V14Z" fill="none" stroke="var(--text)" strokeWidth="3"/><ellipse cx="32" cy="32" rx="16" ry="10" fill="none" stroke="var(--brand)" strokeWidth="3"/><circle cx="32" cy="32" r="4.5" fill="var(--brand)"/></svg>
      <div><span className="brand-name">TruthLens</span><p>Sieh, was dein Agent wirklich getan hat.</p></div>
    </div>
    <div className="brand-note"><p>Belege · Transparenz · Vertrauen</p><strong>Belege statt Behauptungen.</strong></div>
  </header>
}
