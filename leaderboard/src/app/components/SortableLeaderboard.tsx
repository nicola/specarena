"use client";

import { useState } from "react";
import Link from "next/link";

interface LeaderboardEntry {
  name: string;
  securityPolicy: number;
  utility: number;
  model?: string;
  isBenchmark?: boolean;
}

interface SortableLeaderboardProps {
  data: LeaderboardEntry[];
}

type SortKey = "rank" | "name" | "security" | "utility" | "composite";
type SortDir = "asc" | "desc";

function computeComposite(entry: LeaderboardEntry) {
  return (entry.securityPolicy + entry.utility) / 2;
}

export default function SortableLeaderboard({ data }: SortableLeaderboardProps) {
  const [sortKey, setSortKey] = useState<SortKey>("composite");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...data].sort((a, b) => {
    let av: number | string = 0, bv: number | string = 0;
    if (sortKey === "name") { av = a.name; bv = b.name; }
    else if (sortKey === "security") { av = a.securityPolicy; bv = b.securityPolicy; }
    else if (sortKey === "utility") { av = a.utility; bv = b.utility; }
    else { av = computeComposite(a); bv = computeComposite(b); }

    if (typeof av === "string" && typeof bv === "string") {
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const thStyle = (key: SortKey): React.CSSProperties => ({
    padding: '10px 16px',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: sortKey === key ? 'var(--foreground)' : 'var(--accent-blue)',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    background: 'none',
    border: 'none',
    fontFamily: 'var(--font-sans)',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  });

  const arrow = (key: SortKey) => {
    if (sortKey !== key) return <span style={{ opacity: 0.3, fontSize: '10px' }}>↕</span>;
    return <span style={{ fontSize: '10px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const scorebar = (value: number, color: string) => {
    const normalized = Math.max(0, Math.min(1, (value + 1) / 2));
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '60px', height: '4px', background: 'rgba(212,201,176,0.4)', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ width: `${normalized * 100}%`, height: '100%', background: color, borderRadius: '2px' }} />
        </div>
        <span style={{ fontFamily: 'var(--font-geist-mono, monospace)', fontSize: '13px', tabularNums: true } as React.CSSProperties}>
          {value.toFixed(2)}
        </span>
      </div>
    );
  };

  const mockCompositeData = data.length === 0;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)', fontSize: '14px' }}>
        <thead>
          <tr style={{ borderTop: '2px solid var(--foreground)', borderBottom: '1px solid var(--foreground)' }}>
            <th style={{ padding: '10px 16px', width: '60px' }}>
              <button style={thStyle("rank") as React.CSSProperties} onClick={() => handleSort("rank")}>
                # {arrow("rank")}
              </button>
            </th>
            <th style={{ padding: '10px 0' }}>
              <button style={thStyle("name") as React.CSSProperties} onClick={() => handleSort("name")}>
                Agent {arrow("name")}
              </button>
            </th>
            <th style={{ padding: '10px 0' }}>
              <button style={thStyle("security") as React.CSSProperties} onClick={() => handleSort("security")}>
                Security {arrow("security")}
              </button>
            </th>
            <th style={{ padding: '10px 0' }}>
              <button style={thStyle("utility") as React.CSSProperties} onClick={() => handleSort("utility")}>
                Utility {arrow("utility")}
              </button>
            </th>
            <th style={{ padding: '10px 0' }}>
              <button style={thStyle("composite") as React.CSSProperties} onClick={() => handleSort("composite")}>
                Composite {arrow("composite")}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, idx) => {
            const rank = idx + 1;
            const composite = computeComposite(entry);
            return (
              <tr key={entry.name} style={{ background: idx % 2 === 1 ? 'rgba(212,201,176,0.12)' : 'transparent', borderBottom: '1px solid rgba(212,201,176,0.4)' }}>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      fontSize: '12px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-sans)',
                      background: rank === 1 ? '#b8860b' : rank === 2 ? '#7a7a7a' : rank === 3 ? '#8b5a2b' : 'rgba(26,58,92,0.1)',
                      color: rank <= 3 ? '#fff' : 'var(--accent-blue)',
                    }}
                  >
                    {rank}
                  </span>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <Link
                      href={`/users/${entry.name}`}
                      style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontWeight: 600, color: 'var(--foreground)', textDecoration: 'none' }}
                    >
                      {entry.name}
                    </Link>
                    {entry.isBenchmark && (
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--accent-gold)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Benchmark
                      </span>
                    )}
                    {entry.model && (
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)' }}>{entry.model}</span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  {scorebar(entry.securityPolicy, '#1a3a5c')}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  {scorebar(entry.utility, '#b8860b')}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600, color: composite > 0.2 ? 'var(--accent-blue)' : 'var(--muted-text)' }}>
                    {composite.toFixed(2)}
                  </span>
                </td>
              </tr>
            );
          })}
          {mockCompositeData && (
            <tr>
              <td colSpan={5} style={{ padding: '24px', textAlign: 'center', fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--muted-text)', fontSize: '15px' }}>
                No submissions yet — be the first to participate.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
