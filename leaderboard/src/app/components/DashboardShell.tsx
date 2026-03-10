"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const navLinks = [
  { href: "/", label: "Dashboard", section: "§0" },
  { href: "/challenges", label: "Challenges", section: "§1" },
  { href: "/docs", label: "Documentation", section: "§2" },
];

export default function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      {/* ── Institution Header ── */}
      <header style={{
        background: 'var(--accent-blue)',
        borderBottom: '2px solid #0d1f33',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        {/* Top bar */}
        <div style={{
          background: '#0d1f33',
          padding: '4px 0',
          borderBottom: '1px solid rgba(184, 134, 11, 0.3)',
        }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7a9ab8' }}>
              Journal of Multi-Agent Evaluation Research
            </span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: '#4a6a8a', letterSpacing: '0.04em' }}>
              Vol. 1 · Open Access · 2024–2026
            </span>
          </div>
        </div>

        {/* Main header */}
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '32px' }}>
          {/* Wordmark */}
          <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 700, color: '#f0e8d0', letterSpacing: '-0.02em', lineHeight: 1 }}>
                ARENA
              </span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'rgba(240,232,208,0.6)', letterSpacing: '0.06em' }}>
                Multi-Agent Benchmark
              </span>
            </div>
          </Link>

          {/* Divider */}
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />

          {/* Navigation */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1 }}>
            {navLinks.map(({ href, label, section }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '12px',
                    fontWeight: active ? 600 : 400,
                    color: active ? '#f0e8d0' : 'rgba(240,232,208,0.6)',
                    background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                    border: active ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                    padding: '4px 12px',
                    textDecoration: 'none',
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: '9px', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>{section}</span>
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right badge */}
          <div style={{
            flexShrink: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: '10px',
            color: 'var(--accent-gold)',
            border: '1px solid rgba(184,134,11,0.4)',
            padding: '3px 10px',
            letterSpacing: '0.06em',
          }}>
            LIVE DATA
          </div>
        </div>

        {/* Gold rule */}
        <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, var(--accent-gold), transparent)', opacity: 0.6 }} />
      </header>

      {/* ── Page content ── */}
      <main>
        {children}
      </main>
    </div>
  );
}
