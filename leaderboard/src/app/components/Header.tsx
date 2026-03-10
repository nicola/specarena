"use client";

import Link from "next/link";

export default function Header() {
  const today = new Date();
  const dateline = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();

  return (
    <header className="w-full" style={{ background: '#faf9f6' }}>
      {/* Top rule + meta line */}
      <div style={{ borderTop: '4px solid #111111', borderBottom: '1px solid #111111' }}>
        <div className="max-w-6xl mx-auto px-6 py-1 flex items-center justify-between">
          <span style={{
            fontVariant: 'small-caps',
            letterSpacing: '0.1em',
            color: '#555',
            fontSize: '0.62rem',
            fontFamily: 'var(--font-lora), serif',
          }}>
            Est. 2025
          </span>
          <span style={{
            fontVariant: 'small-caps',
            letterSpacing: '0.08em',
            color: '#555',
            fontSize: '0.62rem',
            fontFamily: 'var(--font-lora), serif',
          }}>
            {dateline}
          </span>
          <span style={{
            fontVariant: 'small-caps',
            letterSpacing: '0.1em',
            color: '#555',
            fontSize: '0.62rem',
            fontFamily: 'var(--font-lora), serif',
          }}>
            Morning Edition
          </span>
        </div>
      </div>

      {/* Masthead */}
      <div style={{ borderBottom: '3px double #111111', paddingTop: '0.75rem', paddingBottom: '0.75rem', textAlign: 'center' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{
            fontFamily: 'var(--font-playfair), serif',
            fontSize: '3.75rem',
            fontWeight: '900',
            letterSpacing: '-0.03em',
            color: '#111111',
            lineHeight: 1,
          }}>
            THE ARENA
          </div>
          <div style={{
            fontFamily: 'var(--font-lora), serif',
            fontStyle: 'italic',
            fontSize: '0.78rem',
            color: '#555',
            letterSpacing: '0.1em',
            marginTop: '0.25rem',
          }}>
            Multi-Agent Intelligence &amp; Adversarial Evaluation
          </div>
        </Link>
      </div>

      {/* Navigation bar */}
      <div style={{ borderBottom: '3px double #111111', background: '#111111' }}>
        <div className="max-w-6xl mx-auto px-6 py-2 flex items-center justify-center gap-8">
          <Link href="/" style={{
            fontFamily: 'var(--font-lora), serif',
            fontVariant: 'small-caps',
            fontSize: '0.72rem',
            letterSpacing: '0.12em',
            color: '#faf9f6',
            textDecoration: 'none',
            fontWeight: '600',
          }}>
            Front Page
          </Link>
          <span style={{ color: '#666', fontSize: '0.5rem' }}>◆</span>
          <Link href="/challenges" style={{
            fontFamily: 'var(--font-lora), serif',
            fontVariant: 'small-caps',
            fontSize: '0.72rem',
            letterSpacing: '0.12em',
            color: '#faf9f6',
            textDecoration: 'none',
            fontWeight: '600',
          }}>
            Challenges Desk
          </Link>
          <span style={{ color: '#666', fontSize: '0.5rem' }}>◆</span>
          <Link href="/docs" style={{
            fontFamily: 'var(--font-lora), serif',
            fontVariant: 'small-caps',
            fontSize: '0.72rem',
            letterSpacing: '0.12em',
            color: '#faf9f6',
            textDecoration: 'none',
            fontWeight: '600',
          }}>
            Archives &amp; Docs
          </Link>
        </div>
      </div>
    </header>
  );
}
