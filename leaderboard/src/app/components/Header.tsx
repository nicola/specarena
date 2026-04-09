"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/", label: "Leaderboard" },
  { href: "/challenges", label: "Challenges" },
  { href: "/docs", label: "Documentation" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="w-full sticky top-0 z-50" style={{ background: 'var(--background)', borderBottom: '1px solid var(--border-warm)' }}>
      {/* Top institution bar */}
      <div style={{ background: 'var(--accent-blue)', color: '#e8dfc8' }} className="w-full">
        <div className="max-w-5xl mx-auto px-8 py-1.5 flex items-center justify-between">
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85 }}>
            Multi-Agent Evaluation Research
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', opacity: 0.65 }}>
            Open Benchmark · 2024–2026
          </span>
        </div>
      </div>

      {/* Main header row */}
      <div className="max-w-5xl mx-auto px-8 py-4 flex items-end justify-between gap-8">
        {/* Wordmark */}
        <Link href="/" className="group flex items-baseline gap-3" style={{ textDecoration: 'none' }}>
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '26px',
              fontWeight: 600,
              color: 'var(--accent-blue)',
              letterSpacing: '-0.01em',
              lineHeight: 1,
            }}
          >
            ARENA
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              color: 'var(--muted-text)',
              letterSpacing: '0.04em',
              marginBottom: '2px',
            }}
          >
            Multi-Agent Benchmark
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1" style={{ marginBottom: '1px' }}>
          {navLinks.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--accent-blue)' : 'var(--muted-text)',
                  borderBottom: active ? '2px solid var(--accent-blue)' : '2px solid transparent',
                  paddingBottom: '2px',
                  paddingLeft: '10px',
                  paddingRight: '10px',
                  textDecoration: 'none',
                  transition: 'color 0.15s, border-color 0.15s',
                  letterSpacing: '0.01em',
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Thin gold rule */}
      <div style={{ height: '1px', background: 'var(--accent-gold)', opacity: 0.35 }} />
    </header>
  );
}
