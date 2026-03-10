"use client";

import Link from "next/link";
import { useState, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

function ArenaLogo() {
  const [fighting, setFighting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEnter = useCallback(() => {
    setFighting(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFighting(false), 2000);
  }, []);

  const onLeave = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setFighting(false);
  }, []);

  return (
    <Link
      href="/"
      className="group relative flex items-center gap-2"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <style>{`
        @keyframes f1 { 0%,100%{transform:translate(0,0) rotate(0)} 25%{transform:translate(-1px,1px) rotate(-8deg)} 50%{transform:translate(1px,-1px) rotate(7deg)} 75%{transform:translate(-0.5px,-0.5px) rotate(-5deg)} }
        @keyframes f2 { 0%,100%{transform:translate(0,0) rotate(0)} 20%{transform:translate(1px,0.5px) rotate(9deg)} 50%{transform:translate(-1px,1px) rotate(-7deg)} 80%{transform:translate(0.5px,-1px) rotate(5deg)} }
        @keyframes f3 { 0%,100%{transform:translate(0,0) rotate(0)} 30%{transform:translate(1px,-1px) rotate(10deg)} 60%{transform:translate(-1px,0.5px) rotate(-8deg)} 85%{transform:translate(0.5px,-0.5px) rotate(5deg)} }
        @keyframes f4 { 0%,100%{transform:translate(0,0) rotate(0)} 15%{transform:translate(-1px,0.5px) rotate(-9deg)} 45%{transform:translate(1px,1px) rotate(8deg)} 70%{transform:translate(-0.5px,-1px) rotate(-6deg)} }
        @keyframes f5 { 0%,100%{transform:translate(0,0) rotate(0)} 35%{transform:translate(0.5px,1px) rotate(8deg)} 55%{transform:translate(-1px,-0.5px) rotate(-9deg)} 80%{transform:translate(1px,0.5px) rotate(5deg)} }
        .nf1{animation:f1 .4s ease-in-out infinite paused}
        .nf2{animation:f2 .35s ease-in-out infinite paused}
        .nf3{animation:f3 .45s ease-in-out infinite paused}
        .nf4{animation:f4 .38s ease-in-out infinite paused}
        .nf5{animation:f5 .42s ease-in-out infinite paused}
        .nfighting .nf1,.nfighting .nf2,.nfighting .nf3,.nfighting .nf4,.nfighting .nf5{animation-play-state:running}

        @keyframes logo-glitch-1 {
          0%,100%{clip-path:inset(0 0 95% 0);transform:translate(-3px,0);color:#ff0090}
          30%{clip-path:inset(40% 0 40% 0);transform:translate(3px,0);color:#ff0090}
          60%{clip-path:inset(80% 0 5% 0);transform:translate(-2px,0);color:#ff0090}
        }
        @keyframes logo-glitch-2 {
          0%,100%{clip-path:inset(60% 0 20% 0);transform:translate(2px,0);color:#00ffff}
          40%{clip-path:inset(10% 0 75% 0);transform:translate(-3px,0);color:#00ffff}
          70%{clip-path:inset(50% 0 30% 0);transform:translate(2px,0);color:#00ffff}
        }
        @keyframes logo-skew {
          0%,100%{transform:skewX(0deg)}
          10%{transform:skewX(-1.5deg)}
          20%{transform:skewX(0.8deg)}
          30%{transform:skewX(0deg)}
          85%{transform:skewX(0.4deg)}
          90%{transform:skewX(-0.6deg)}
        }
        @keyframes neon-logo-pulse {
          0%,100%{text-shadow:0 0 8px #00ffff,0 0 20px #00ffff,0 0 40px rgba(0,255,255,0.6)}
          50%{text-shadow:0 0 12px #00ffff,0 0 30px #00ffff,0 0 60px rgba(0,255,255,0.8),0 0 80px rgba(0,255,255,0.3)}
        }
        .arena-logo-text {
          position: relative;
          display: inline-block;
          animation: logo-skew 6s infinite linear alternate-reverse, neon-logo-pulse 2s ease-in-out infinite;
          color: #00ffff;
        }
        .arena-logo-text::before, .arena-logo-text::after {
          content: attr(data-text);
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          font: inherit;
        }
        .arena-logo-text::before {
          animation: logo-glitch-1 4s infinite linear;
        }
        .arena-logo-text::after {
          animation: logo-glitch-2 3.5s infinite linear;
        }
      `}</style>

      {/* Glitch-animated ARENA text */}
      <span
        className={`arena-logo-text text-xl font-black tracking-widest uppercase ${fighting ? 'nfighting' : ''}`}
        data-text="ARENA"
        style={{ fontFamily: 'var(--font-orbitron), monospace' }}
      >
        <span className="nf1 inline-block relative z-[3]">A</span><span className="nf2 inline-block relative z-[4]">R</span><span className="nf3 inline-block relative z-[3]">E</span><span className="nf4 inline-block relative z-[5]">N</span><span className="nf5 inline-block relative z-[4]">A</span>
      </span>

      {/* Neon dot indicator */}
      <span className="blink-dot" style={{ marginTop: '2px' }} />
    </Link>
  );
}

export default function Header() {
  const pathname = usePathname();

  const navLink = (href: string, label: string) => {
    const active = pathname === href || (href !== '/' && pathname?.startsWith(href));
    return (
      <Link
        href={href}
        className="relative text-xs tracking-widest uppercase transition-all duration-200"
        style={{
          fontFamily: 'var(--font-share-tech-mono), monospace',
          color: active ? '#00ffff' : 'rgba(255,255,255,0.6)',
          textShadow: active ? '0 0 8px #00ffff, 0 0 16px rgba(0,255,255,0.5)' : 'none',
        }}
      >
        {active && <span style={{ color: '#00ffff', marginRight: '4px', opacity: 0.7 }}>&gt;</span>}
        {label}
      </Link>
    );
  };

  return (
    <header
      className="w-full sticky top-0 z-50"
      style={{
        background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(0,255,255,0.25)',
        boxShadow: '0 1px 20px rgba(0,255,255,0.1)',
      }}
    >
      {/* Top accent bar */}
      <div style={{
        height: '2px',
        background: 'linear-gradient(90deg, transparent, #00ffff, #ff0090, #00ff41, transparent)',
        opacity: 0.8,
      }} />

      <div className="max-w-5xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <ArenaLogo />
            <nav className="flex items-center gap-6">
              {navLink('/', 'Leaderboard')}
              {navLink('/challenges', 'Challenges')}
              {navLink('/docs', 'Docs')}
            </nav>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-share-tech-mono), monospace' }}>
            <span className="blink-dot" style={{ width: '6px', height: '6px' }} />
            <span style={{ color: '#00ff41' }}>SYSTEM ONLINE</span>
          </div>
        </div>
      </div>
    </header>
  );
}
