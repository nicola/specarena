"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Leaderboard" },
    { href: "/challenges", label: "Challenges" },
    { href: "/docs", label: "Docs" },
  ];

  return (
    <header className="w-full border-b sticky top-0 z-50 bg-white" style={{ borderColor: '#eeeeee' }}>
      <div className="max-w-4xl mx-auto px-8 py-5">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span style={{ color: '#cc0000', fontSize: '10px', lineHeight: 1 }}>■</span>
            <span
              className="text-sm tracking-[0.2em] uppercase"
              style={{ color: '#aaaaaa', fontWeight: 400, letterSpacing: '0.25em' }}
            >
              ARENA
            </span>
          </Link>
          <nav className="flex items-center gap-10">
            {navItems.map(({ href, label }) => {
              const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className="text-xs tracking-wide transition-colors"
                  style={{
                    color: isActive ? '#cc0000' : '#aaaaaa',
                    fontWeight: isActive ? 500 : 400,
                    letterSpacing: '0.08em',
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
