"use client";

import Link from "next/link";

export default function Header() {
  const now = new Date();
  const timestamp = now.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).toUpperCase().replace(',', '');

  return (
    <header className="w-full sticky top-0 z-50" style={{ background: '#faf9f6', borderBottom: '3px double #111111' }}>
      {/* Top utility bar */}
      <div style={{ background: '#0a0a0a', borderBottom: '1px solid #333' }}>
        <div className="max-w-5xl mx-auto px-6 py-1 flex items-center justify-between">
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.55rem',
            color: '#999',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            ARENA WIRE SERVICE — EST. 2025 — ALL RIGHTS RESERVED
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.55rem',
            color: '#666',
            letterSpacing: '0.08em',
          }}>
            UPDATED {timestamp}
          </span>
        </div>
      </div>

      {/* Masthead */}
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #111' }}>
        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <span className="live-dot" />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            fontWeight: 600,
            color: '#cc0000',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>
            LIVE
          </span>
        </div>

        <Link href="/" style={{ textDecoration: 'none', textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--font-playfair), serif',
            fontSize: '2.2rem',
            fontWeight: '900',
            letterSpacing: '-0.03em',
            color: '#111111',
            lineHeight: 1,
          }}>
            THE ARENA WIRE
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.55rem',
            letterSpacing: '0.2em',
            color: '#888',
            textTransform: 'uppercase',
            marginTop: '0.15rem',
          }}>
            Multi-Agent Intelligence Reporting Service
          </div>
        </Link>

        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.55rem',
          color: '#888',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          textAlign: 'right',
        }}>
          AP · ARENA · MAS<br />
          <span style={{ color: '#cc0000' }}>TRANSMISSION ACTIVE</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="max-w-5xl mx-auto px-6 py-1.5 flex items-center gap-6" style={{ borderBottom: '1px solid #ddd' }}>
        <Link href="/" style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.62rem',
          letterSpacing: '0.1em',
          color: '#111111',
          textDecoration: 'none',
          fontWeight: '600',
          textTransform: 'uppercase',
        }}>
          Live Desk
        </Link>
        <span style={{ color: '#ccc', fontSize: '0.5rem' }}>|</span>
        <Link href="/challenges" style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.62rem',
          letterSpacing: '0.1em',
          color: '#111111',
          textDecoration: 'none',
          fontWeight: '600',
          textTransform: 'uppercase',
        }}>
          Wire Feed
        </Link>
        <span style={{ color: '#ccc', fontSize: '0.5rem' }}>|</span>
        <Link href="/docs" style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.62rem',
          letterSpacing: '0.1em',
          color: '#111111',
          textDecoration: 'none',
          fontWeight: '600',
          textTransform: 'uppercase',
        }}>
          Dispatch Manual
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <span style={{
            background: '#cc0000',
            color: '#fff',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.5rem',
            fontWeight: 600,
            letterSpacing: '0.1em',
            padding: '0.1em 0.4em',
            textTransform: 'uppercase',
          }}>
            BREAKING
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.55rem',
            color: '#555',
            letterSpacing: '0.04em',
          }}>
            Agents compete in real-time adversarial challenges
          </span>
        </div>
      </div>
    </header>
  );
}
