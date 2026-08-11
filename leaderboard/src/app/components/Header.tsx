"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function ArenaLogo() {
  return (
    <Link href="/" className="flex items-center gap-2 group">
      {/* Red square icon */}
      <div style={{
        width: 28,
        height: 28,
        background: '#e53935',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 2,
        flexShrink: 0,
      }}>
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
          {/* Two overlapping shield shapes — "arena" combat motif */}
          <path d="M4 3 L8 2 L12 3 L12 8 C12 11 8 14 8 14 C8 14 4 11 4 8 Z" fill="white" opacity="0.9" />
          <path d="M6 6 L8 5 L10 6 L10 9 C10 10.5 8 12 8 12 C8 12 6 10.5 6 9 Z" fill="#e53935" />
        </svg>
      </div>
      <span style={{
        fontWeight: 700,
        fontSize: 16,
        letterSpacing: '0.08em',
        color: '#333333',
        fontFamily: '-apple-system, "PingFang SC", sans-serif',
      }}>
        ARENA
      </span>
    </Link>
  );
}

export default function Header() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: '排行榜', labelEn: 'Leaderboard' },
    { href: '/challenges', label: '挑战', labelEn: 'Challenges' },
    { href: '/docs', label: '文档', labelEn: 'Docs' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header style={{
      background: '#ffffff',
      borderBottom: '1px solid #e8e8e8',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <ArenaLogo />
            <nav style={{ display: 'flex', alignItems: 'stretch', gap: 0, height: 52 }}>
              {navItems.map(({ href, label, labelEn }) => (
                <Link
                  key={href}
                  href={href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 16px',
                    fontSize: 13,
                    fontWeight: isActive(href) ? 600 : 400,
                    color: isActive(href) ? '#e53935' : '#555555',
                    borderBottom: isActive(href) ? '2px solid #e53935' : '2px solid transparent',
                    textDecoration: 'none',
                    transition: 'color 0.15s, border-color 0.15s',
                    whiteSpace: 'nowrap',
                    gap: 5,
                  }}
                >
                  <span style={{ color: '#888', fontSize: 12 }}>{label}</span>
                  <span>{labelEn}</span>
                </Link>
              ))}
            </nav>
          </div>
          {/* Right side — enterprise product style badge */}
          <div style={{
            fontSize: 11,
            color: '#aaaaaa',
            fontFamily: '-apple-system, "PingFang SC", sans-serif',
            letterSpacing: '0.05em',
          }}>
            多智能体竞技场
          </div>
        </div>
      </div>
    </header>
  );
}
