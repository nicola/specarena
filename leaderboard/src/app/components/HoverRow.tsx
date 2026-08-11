"use client";

import { ReactNode } from "react";

interface HoverRowProps {
  children: ReactNode;
  href?: string;
  isTop3?: boolean;
  style?: React.CSSProperties;
}

export function HoverRow({ children, isTop3, style }: HoverRowProps) {
  return (
    <div
      className="flex items-center"
      style={{
        padding: '0.5rem 0',
        borderBottom: '1px solid #e8e4dc',
        cursor: 'pointer',
        transition: 'background 0.1s',
        background: isTop3 ? '#fdf8f0' : 'transparent',
        ...style,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f0ede6')}
      onMouseLeave={e => (e.currentTarget.style.background = isTop3 ? '#fdf8f0' : 'transparent')}
    >
      {children}
    </div>
  );
}

export function HoverBlock({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        cursor: 'pointer',
        transition: 'background 0.12s',
        ...style,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f0ede6')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </div>
  );
}
