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
        @keyframes f1 { 0%,100%{transform:translate(0,0) rotate(0)} 25%{transform:translate(-2px,1px) rotate(-10deg)} 50%{transform:translate(2px,-1px) rotate(9deg)} 75%{transform:translate(-1px,-1px) rotate(-6deg)} }
        @keyframes f2 { 0%,100%{transform:translate(0,0) rotate(0)} 20%{transform:translate(2px,1px) rotate(11deg)} 50%{transform:translate(-2px,1px) rotate(-9deg)} 80%{transform:translate(1px,-1px) rotate(6deg)} }
        @keyframes f3 { 0%,100%{transform:translate(0,0) rotate(0)} 30%{transform:translate(2px,-2px) rotate(12deg)} 60%{transform:translate(-2px,1px) rotate(-10deg)} 85%{transform:translate(1px,-1px) rotate(6deg)} }
        @keyframes f4 { 0%,100%{transform:translate(0,0) rotate(0)} 15%{transform:translate(-2px,1px) rotate(-11deg)} 45%{transform:translate(2px,2px) rotate(10deg)} 70%{transform:translate(-1px,-2px) rotate(-7deg)} }
        @keyframes f5 { 0%,100%{transform:translate(0,0) rotate(0)} 35%{transform:translate(1px,2px) rotate(10deg)} 55%{transform:translate(-2px,-1px) rotate(-11deg)} 80%{transform:translate(2px,1px) rotate(6deg)} }
        .f1{animation:f1 .4s ease-in-out infinite paused}
        .f2{animation:f2 .35s ease-in-out infinite paused}
        .f3{animation:f3 .45s ease-in-out infinite paused}
        .f4{animation:f4 .38s ease-in-out infinite paused}
        .f5{animation:f5 .42s ease-in-out infinite paused}
        .fighting .f1,.fighting .f2,.fighting .f3,.fighting .f4,.fighting .f5{animation-play-state:running}
        @keyframes logo-glow {
          0%, 100% { filter: drop-shadow(0 0 8px #ff006e) drop-shadow(0 0 16px #8338ec44); }
          50% { filter: drop-shadow(0 0 14px #ff006e) drop-shadow(0 0 28px #ff006e66); }
        }
        .logo-text { animation: logo-glow 3s ease-in-out infinite; }
      `}</style>
      <span
        className={`logo-text relative text-2xl font-black tracking-widest ${fighting ? 'fighting' : ''}`}
        style={{
          fontFamily: 'var(--font-orbitron), sans-serif',
          background: 'linear-gradient(135deg, #ff006e, #8338ec, #00d4ff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        <span className="inline-block f1">A</span>
        <span className="inline-block f2">R</span>
        <span className="inline-block f3">E</span>
        <span className="inline-block f4">N</span>
        <span className="inline-block f5">A</span>
      </span>
    </Link>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className="relative text-sm font-medium tracking-wider transition-all duration-200 group"
      style={{
        fontFamily: 'var(--font-orbitron), sans-serif',
        color: isActive ? '#ff006e' : '#c4a8e0',
        fontSize: '0.7rem',
        letterSpacing: '0.1em',
      }}
    >
      {children}
      <span
        className="absolute -bottom-1 left-0 h-px transition-all duration-200"
        style={{
          background: 'linear-gradient(90deg, #ff006e, #00d4ff)',
          width: isActive ? '100%' : '0%',
        }}
      />
      <span
        className="absolute -bottom-1 left-0 h-px w-0 group-hover:w-full transition-all duration-200"
        style={{
          background: 'linear-gradient(90deg, #ff006e, #00d4ff)',
        }}
      />
    </Link>
  );
}

export default function Header() {
  return (
    <header
      className="w-full sticky top-0 z-50"
      style={{
        background: 'rgba(26, 5, 51, 0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 0, 110, 0.4)',
        boxShadow: '0 2px 20px rgba(255, 0, 110, 0.15), 0 1px 0 rgba(131, 56, 236, 0.3)',
      }}
    >
      {/* Top accent line */}
      <div style={{
        height: '2px',
        background: 'linear-gradient(90deg, #ff006e, #8338ec, #00d4ff, #8338ec, #ff006e)',
        backgroundSize: '200% 100%',
      }} />
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <ArenaLogo />
            <nav className="flex items-center gap-6">
              <NavLink href="/">Leaderboard</NavLink>
              <NavLink href="/challenges">Challenges</NavLink>
              <NavLink href="/docs">Docs</NavLink>
            </nav>
          </div>
          {/* Decorative element */}
          <div className="flex items-center gap-2 opacity-60">
            <span style={{ color: '#ff006e', fontSize: '0.6rem' }}>◆</span>
            <span style={{ color: '#8338ec', fontSize: '0.6rem' }}>◆</span>
            <span style={{ color: '#00d4ff', fontSize: '0.6rem' }}>◆</span>
          </div>
        </div>
      </div>
    </header>
  );
}
