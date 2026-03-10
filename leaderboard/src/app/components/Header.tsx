"use client";

import Link from "next/link";
import { useState, useRef, useCallback } from "react";

export default function Header() {
  return (
    <header style={{
      width: '100%',
      borderBottom: '1px solid #ffb000',
      background: '#0d0a00',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <Link href="/" style={{
              fontFamily: '"Courier New", monospace',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              color: '#ffcc44',
              textDecoration: 'none',
              letterSpacing: '0.15em',
              textShadow: '0 0 12px #ffcc44, 0 0 20px #ffb000',
            }}>
              [ARENA]
            </Link>
            <nav style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              {[
                { href: '/', label: 'Leaderboard' },
                { href: '/challenges', label: 'Challenges' },
                { href: '/docs', label: 'Docs' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  style={{
                    fontFamily: '"Courier New", monospace',
                    fontSize: '0.8rem',
                    color: '#cc8800',
                    textDecoration: 'none',
                    textShadow: '0 0 6px #cc8800',
                    letterSpacing: '0.05em',
                    transition: 'color 0.1s, text-shadow 0.1s',
                  }}
                  onMouseEnter={e => {
                    (e.target as HTMLElement).style.color = '#ffcc44';
                    (e.target as HTMLElement).style.textShadow = '0 0 10px #ffcc44';
                  }}
                  onMouseLeave={e => {
                    (e.target as HTMLElement).style.color = '#cc8800';
                    (e.target as HTMLElement).style.textShadow = '0 0 6px #cc8800';
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
