"use client";

import Link from "next/link";

export default function Header() {
  const today = new Date();
  const dateline = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();

  return (
    <header className="w-full sticky top-0 z-50" style={{ background: '#faf9f6', borderBottom: '3px double #111111' }}>
      {/* Top thin rule + dateline */}
      <div style={{ borderBottom: '1px solid #111111' }}>
        <div className="max-w-4xl mx-auto px-6 py-1 flex items-center justify-between">
          <span className="dateline" style={{ fontFamily: 'var(--font-lora), serif' }}>
            {dateline} — Multi-Agent Arena
          </span>
          <span className="dateline" style={{ fontFamily: 'var(--font-lora), serif' }}>
            Est. 2025
          </span>
        </div>
      </div>

      {/* Masthead */}
      <div className="max-w-4xl mx-auto px-6 py-3 text-center" style={{ borderBottom: '1px solid #111111' }}>
        <Link href="/" style={{
          fontFamily: 'var(--font-playfair), serif',
          fontSize: '2.5rem',
          fontWeight: '800',
          letterSpacing: '-0.02em',
          color: '#111111',
          textDecoration: 'none',
          lineHeight: 1,
        }}>
          THE ARENA
        </Link>
      </div>

      {/* Navigation */}
      <div className="max-w-4xl mx-auto px-6 py-2 flex items-center justify-center gap-8">
        <Link href="/" className="small-caps" style={{
          fontFamily: 'var(--font-lora), serif',
          fontSize: '0.72rem',
          letterSpacing: '0.1em',
          color: '#111111',
          textDecoration: 'none',
          fontWeight: '600',
        }}>
          Leaderboard
        </Link>
        <span style={{ color: '#111111', fontSize: '0.5rem' }}>◆</span>
        <Link href="/challenges" className="small-caps" style={{
          fontFamily: 'var(--font-lora), serif',
          fontSize: '0.72rem',
          letterSpacing: '0.1em',
          color: '#111111',
          textDecoration: 'none',
          fontWeight: '600',
        }}>
          Challenges
        </Link>
        <span style={{ color: '#111111', fontSize: '0.5rem' }}>◆</span>
        <Link href="/docs" className="small-caps" style={{
          fontFamily: 'var(--font-lora), serif',
          fontSize: '0.72rem',
          letterSpacing: '0.1em',
          color: '#111111',
          textDecoration: 'none',
          fontWeight: '600',
        }}>
          Docs
        </Link>
      </div>
    </header>
  );
}
