"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChallengeMetadata } from "@arena/engine/types";

interface Props {
  challenges: { slug: string; metadata: ChallengeMetadata }[];
  stats: { challenges: Record<string, { gamesPlayed: number }>; global: { participants: number; gamesPlayed: number } } | null;
}

export default function ChallengesBrowse({ challenges, stats }: Props) {
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [playerFilter, setPlayerFilter] = useState("all");

  // Collect all tags/subjects
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    challenges.forEach(({ metadata }) => metadata.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [challenges]);

  // Collect player counts
  const allPlayerCounts = useMemo(() => {
    const counts = new Set<number>();
    challenges.forEach(({ metadata }) => {
      if (metadata.players) counts.add(metadata.players);
    });
    return Array.from(counts).sort((a, b) => a - b);
  }, [challenges]);

  // Filtered list
  const filtered = useMemo(() => {
    return challenges.filter(({ metadata }) => {
      const tagOk = subjectFilter === "all" || metadata.tags?.includes(subjectFilter);
      const playerOk = playerFilter === "all" || String(metadata.players) === playerFilter;
      return tagOk && playerOk;
    });
  }, [challenges, subjectFilter, playerFilter]);

  return (
    <>
      {/* ── Browse filters ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--border-warm)',
      }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-text)', flexShrink: 0 }}>
          Browse by:
        </span>

        {/* Subject filter */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
            Subject
          </label>
          <select
            className="subject-filter"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
          >
            <option value="all">All subjects</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>

        {/* Player count filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
            Players
          </label>
          <select
            className="subject-filter"
            value={playerFilter}
            onChange={(e) => setPlayerFilter(e.target.value)}
          >
            <option value="all">Any count</option>
            {allPlayerCounts.map((n) => (
              <option key={n} value={String(n)}>{n}-player</option>
            ))}
          </select>
        </div>

        {/* Result count */}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
          {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'} found
        </span>
      </div>

      {/* ── Table of Contents entries ── */}
      <div>
        {filtered.length === 0 && (
          <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--muted-text)', fontSize: '16px', paddingTop: '24px' }}>
            No challenges match the selected filters.
          </p>
        )}

        {filtered.map(({ slug, metadata }, idx) => {
          const gamesPlayed = stats?.challenges?.[slug]?.gamesPlayed ?? 0;
          // Find original index for page number
          const origIdx = challenges.findIndex((c) => c.slug === slug);

          return (
            <Link
              key={slug}
              href={`/challenges/${slug}`}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <div
                className="toc-entry"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr auto',
                  gap: '0 24px',
                  alignItems: 'baseline',
                  padding: '18px 0',
                  borderBottom: '1px solid var(--border-warm)',
                  cursor: 'pointer',
                }}
              >
                {/* Entry number */}
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--muted-text)', letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}>
                    No. {String(origIdx + 1).padStart(2, '0')}
                  </span>
                </div>

                {/* Entry body */}
                <div>
                  {/* Title + dotted leader */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '21px',
                      fontWeight: 600,
                      color: 'var(--foreground)',
                      lineHeight: 1.25,
                      flexShrink: 0,
                    }}>
                      {metadata.name}
                    </span>
                    <span style={{
                      flex: 1,
                      borderBottom: '1px dotted var(--border-warm)',
                      marginBottom: '4px',
                      minWidth: '20px',
                    }} />
                  </div>

                  {/* Authors */}
                  {metadata.authors && metadata.authors.length > 0 && (
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--muted-text)', margin: '3px 0 5px', lineHeight: 1.4 }}>
                      {metadata.authors.map((a: { name: string }, i: number) => (
                        <span key={a.name}>{i > 0 && ' · '}{a.name}</span>
                      ))}
                    </p>
                  )}

                  {/* Tags row */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {metadata.players && (
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-text)', border: '1px solid var(--border-warm)', padding: '1px 5px' }}>
                        {metadata.players}-player
                      </span>
                    )}
                    {metadata.tags?.map((tag) => (
                      <span key={tag} style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-blue)', border: '1px solid var(--accent-blue)', padding: '1px 5px', opacity: 0.75 }}>
                        {tag}
                      </span>
                    ))}
                    {gamesPlayed > 0 && (
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', color: 'var(--muted-text)', letterSpacing: '0.03em', padding: '1px 0' }}>
                        {gamesPlayed.toLocaleString()} sessions
                      </span>
                    )}
                  </div>
                </div>

                {/* Right-aligned page marker */}
                <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '32px' }}>
                  <span style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '16px',
                    color: 'var(--accent-blue)',
                    fontVariantNumeric: 'oldstyle-nums',
                    letterSpacing: '-0.01em',
                  }}>
                    p.{origIdx + 1}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}

        {/* Submission pending — ghost entry */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '60px 1fr auto',
          gap: '0 24px',
          alignItems: 'baseline',
          padding: '18px 0 0',
          opacity: 0.45,
        }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
              No. {String(challenges.length + 1).padStart(2, '0')}
            </span>
          </div>
          <div>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '21px', fontWeight: 400, color: 'var(--muted-text)', fontStyle: 'italic' }}>
              [Submission Pending Review]
            </span>
            <div style={{ marginTop: '6px' }}>
              <a
                href="https://github.com/nicolapps/arena"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-text)', textDecoration: 'none', borderBottom: '1px solid var(--border-warm)', paddingBottom: '1px' }}>
                Submit proposal →
              </a>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: 'var(--muted-text)' }}>
              p.—
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
