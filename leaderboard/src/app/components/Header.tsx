"use client";

import Link from "next/link";

export default function Header() {
  const today = new Date();
  const dateline = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();

  return (
    <header className="w-full sticky top-0 z-50" style={{ background: '#faf9f6', borderBottom: '1px solid #111111' }}>
      {/* Top strip — dateline + tagline */}
      <div style={{ borderBottom: '1px solid #d0ccc4', background: '#faf9f6' }}>
        <div className="max-w-5xl mx-auto px-6 py-1 flex items-center justify-between">
          <span style={{
            fontVariant: 'small-caps',
            letterSpacing: '0.12em',
            color: '#8b0000',
            fontSize: '0.6rem',
            fontFamily: 'var(--font-lora), serif',
            fontWeight: 700,
          }}>
            {dateline}
          </span>
          <span style={{
            fontVariant: 'small-caps',
            letterSpacing: '0.1em',
            color: '#aaa',
            fontSize: '0.6rem',
            fontFamily: 'var(--font-lora), serif',
          }}>
            Security · Strategy · Performance
          </span>
          <span style={{
            fontVariant: 'small-caps',
            letterSpacing: '0.12em',
            color: '#aaa',
            fontSize: '0.6rem',
            fontFamily: 'var(--font-lora), serif',
          }}>
            Est. 2025
          </span>
        </div>
      </div>

      {/* Masthead — big bold magazine title */}
      <div style={{ background: '#111111', padding: '0.6rem 0' }}>
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" style={{
            fontFamily: 'var(--font-playfair), serif',
            fontSize: 'clamp(1.8rem, 5vw, 3rem)',
            fontWeight: 900,
            letterSpacing: '-0.04em',
            color: '#ffffff',
            textDecoration: 'none',
            lineHeight: 1,
          }}>
            THE ARENA
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{
              background: '#8b0000',
              color: '#ffffff',
              fontVariant: 'small-caps',
              letterSpacing: '0.12em',
              fontSize: '0.55rem',
              fontFamily: 'var(--font-lora), serif',
              fontWeight: 700,
              padding: '0.2em 0.7em',
            }}>
              Live Rankings
            </span>
          </div>
        </div>
      </div>

      {/* Navigation bar */}
      <div style={{ borderBottom: '3px double #111111', background: '#faf9f6' }}>
        <div className="max-w-5xl mx-auto px-6 py-2 flex items-center gap-8 justify-center">
          {[
            { href: '/', label: 'Leaderboard' },
            { href: '/challenges', label: 'Challenges' },
            { href: '/docs', label: 'Docs' },
          ].map(({ href, label }, i) => (
            <>
              {i > 0 && (
                <span key={`sep-${i}`} style={{ color: '#ccc', fontSize: '0.45rem' }}>◆</span>
              )}
              <Link key={href} href={href} style={{
                fontVariant: 'small-caps',
                letterSpacing: '0.12em',
                fontSize: '0.7rem',
                color: '#111111',
                textDecoration: 'none',
                fontFamily: 'var(--font-lora), serif',
                fontWeight: 700,
              }}>
                {label}
              </Link>
            </>
          ))}
        </div>
      </div>
    </header>
  );
}
