"use client";

import Link from "next/link";

function SealLogo() {
  return (
    <Link href="/" className="group flex items-center gap-3 no-underline">
      {/* Red seal stamp motif */}
      <div
        className="relative flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
        style={{
          width: 42,
          height: 42,
          border: '2px solid #cc2200',
          background: 'transparent',
        }}
      >
        {/* Inner border for double-border seal effect */}
        <div style={{
          position: 'absolute',
          inset: 3,
          border: '1px solid #cc2200',
          opacity: 0.5,
        }} />
        <span
          style={{
            fontFamily: 'var(--font-noto-serif), serif',
            fontSize: '13px',
            fontWeight: 700,
            color: '#cc2200',
            letterSpacing: '0.03em',
            lineHeight: 1,
            position: 'relative',
            zIndex: 1,
          }}
        >
          武
        </span>
      </div>
      <span
        style={{
          fontFamily: 'var(--font-noto-serif), serif',
          fontSize: '18px',
          fontWeight: 600,
          color: '#1a1008',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        Arena
      </span>
    </Link>
  );
}

export default function Header() {
  return (
    <header
      className="w-full sticky top-0 z-50"
      style={{
        background: 'rgba(247, 243, 237, 0.92)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #d4c4a8',
      }}
    >
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <SealLogo />
            <nav className="flex items-center gap-6">
              {[
                { href: '/', label: 'Leaderboard' },
                { href: '/challenges', label: 'Challenges' },
                { href: '/docs', label: 'Docs' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="transition-colors duration-200"
                  style={{
                    fontFamily: 'var(--font-noto-sans), sans-serif',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#5a4030',
                    letterSpacing: '0.04em',
                    textDecoration: 'none',
                    borderBottom: '1px solid transparent',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = '#cc2200';
                    (e.currentTarget as HTMLElement).style.borderBottomColor = '#cc2200';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = '#5a4030';
                    (e.currentTarget as HTMLElement).style.borderBottomColor = 'transparent';
                  }}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
