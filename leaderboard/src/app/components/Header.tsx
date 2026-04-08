"use client";

import Link from "next/link";
import { useState, useRef, useCallback } from "react";

const OVAL_WIDTH = 65;
const OVAL_HEIGHT = 19;
const OVAL_Y_SHIFT = 6;
const OVAL_CONTOUR = 3;
const OVAL_STROKE = 1;

function ArenaLogo({ width = OVAL_WIDTH, height = OVAL_HEIGHT, yShift = OVAL_Y_SHIFT, contour = OVAL_CONTOUR, stroke = OVAL_STROKE }: { width?: number; height?: number; yShift?: number; contour?: number; stroke?: number }) {
  const rx = width / 2 - 1;
  const ry = height / 2 - 1;
  const cx = width / 2;
  const cy = height / 2;
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
    <Link href="/" className="group relative flex items-center justify-center" style={{ width: `${width}px`, height: `${height}px` }} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {/* Top half of oval */}
      <svg className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ top: `${yShift}px` }} viewBox={`0 0 ${width} ${height}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="topHalf"><rect x="0" y="0" width={width} height={cy} /></clipPath>
        </defs>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke="rgba(255,255,255,0.7)" strokeWidth={stroke} fill="none" clipPath="url(#topHalf)" />
      </svg>
      {/* Letter fight animations */}
      <style>{`
        @keyframes f1 { 0%,100%{transform:translate(0,0) rotate(0)} 25%{transform:translate(-1px,1px) rotate(-8deg)} 50%{transform:translate(1px,-1px) rotate(7deg)} 75%{transform:translate(-0.5px,-0.5px) rotate(-5deg)} }
        @keyframes f2 { 0%,100%{transform:translate(0,0) rotate(0)} 20%{transform:translate(1px,0.5px) rotate(9deg)} 50%{transform:translate(-1px,1px) rotate(-7deg)} 80%{transform:translate(0.5px,-1px) rotate(5deg)} }
        @keyframes f3 { 0%,100%{transform:translate(0,0) rotate(0)} 30%{transform:translate(1px,-1px) rotate(10deg)} 60%{transform:translate(-1px,0.5px) rotate(-8deg)} 85%{transform:translate(0.5px,-0.5px) rotate(5deg)} }
        @keyframes f4 { 0%,100%{transform:translate(0,0) rotate(0)} 15%{transform:translate(-1px,0.5px) rotate(-9deg)} 45%{transform:translate(1px,1px) rotate(8deg)} 70%{transform:translate(-0.5px,-1px) rotate(-6deg)} }
        @keyframes f5 { 0%,100%{transform:translate(0,0) rotate(0)} 35%{transform:translate(0.5px,1px) rotate(8deg)} 55%{transform:translate(-1px,-0.5px) rotate(-9deg)} 80%{transform:translate(1px,0.5px) rotate(5deg)} }
        .f1{animation:f1 .4s ease-in-out infinite paused}
        .f2{animation:f2 .35s ease-in-out infinite paused}
        .f3{animation:f3 .45s ease-in-out infinite paused}
        .f4{animation:f4 .38s ease-in-out infinite paused}
        .f5{animation:f5 .42s ease-in-out infinite paused}
        .fighting .f1,.fighting .f2,.fighting .f3,.fighting .f4,.fighting .f5{animation-play-state:running}
      `}</style>
      {/* Logo text */}
      <span
        className={`relative z-10 font-bold ${fighting ? 'fighting' : ''}`}
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          background: 'linear-gradient(135deg, #ffffff 0%, #a78bfa 50%, #667eea 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          paintOrder: 'stroke fill',
          WebkitTextStroke: `${contour}px transparent`,
        }}
      >
        <span className="inline-block f1 relative z-[3]">A</span><span className="inline-block f2 relative z-[4]">R</span>
        <span className="inline-block f3 relative text-[12px] font-semibold top-[-4px] left-[2px] z-[3]">E</span>
        <span className="inline-block f4 relative text-[11px] font-bold top-[5px] left-[-2px] ml-[-1px] z-[6]">N</span>
        <span className="inline-block f5 relative z-[5]">A</span>
      </span>
      {/* Bottom half of oval */}
      <svg className="absolute inset-0 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ top: `${yShift}px` }} viewBox={`0 0 ${width} ${height}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="bottomHalf"><rect x="0" y={cy} width={width} height={cy} /></clipPath>
        </defs>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke="rgba(255,255,255,0.7)" strokeWidth={stroke} fill="none" clipPath="url(#bottomHalf)" />
      </svg>
    </Link>
  );
}

export default function Header() {
  return (
    <header className="w-full sticky top-0 z-50 glass" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <div className="flex items-center justify-center">
              <ArenaLogo />
            </div>
            <nav className="flex items-center gap-6">
              <Link href="/" className="text-sm font-medium text-white/70 hover:text-white transition-colors duration-200">
                Leaderboard
              </Link>
              <Link href="/challenges" className="text-sm font-medium text-white/70 hover:text-white transition-colors duration-200">
                Challenges
              </Link>
              <Link href="/docs" className="text-sm font-medium text-white/70 hover:text-white transition-colors duration-200">
                Docs
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
