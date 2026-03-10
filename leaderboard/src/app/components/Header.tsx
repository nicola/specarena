"use client";

import Link from "next/link";

const TERMINAL_STYLE = {
  fontFamily: "'VT323', 'Courier New', Courier, monospace",
} as const;

export default function Header() {
  return (
    <header style={{
      ...TERMINAL_STYLE,
      width: '100%',
      background: '#000000',
      borderBottom: '1px solid #00ff00',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      {/* Title bar */}
      <div style={{
        background: '#00ff00',
        color: '#000000',
        textAlign: 'center',
        fontSize: '14px',
        padding: '1px 0',
        letterSpacing: '2px',
      }}>
        ┤ ARENA v1.0.0 - Multi-Agent Combat System ├
      </div>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '8px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            {/* Logo */}
            <Link href="/" style={{
              ...TERMINAL_STYLE,
              color: '#00ff00',
              fontSize: '24px',
              letterSpacing: '4px',
              textDecoration: 'none',
              fontWeight: 'bold',
            }}>
              [<span style={{ color: '#ffffff' }}>ARENA</span>]
            </Link>
            <nav style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <Link href="/" style={{ ...TERMINAL_STYLE, color: '#00ff00', fontSize: '18px', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#00ff00')}
              >
                $ leaderboard
              </Link>
              <Link href="/challenges" style={{ ...TERMINAL_STYLE, color: '#00ff00', fontSize: '18px', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#00ff00')}
              >
                $ challenges
              </Link>
              <Link href="/docs" style={{ ...TERMINAL_STYLE, color: '#00ff00', fontSize: '18px', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#00ff00')}
              >
                $ docs
              </Link>
            </nav>
          </div>
          <div style={{ color: '#008800', fontSize: '14px' }}>
            <span style={{ color: '#00ff00' }}>▓</span> ONLINE
          </div>
        </div>
      </div>
    </header>
  );
}
