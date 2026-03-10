import { Metadata } from "next";
import Link from "next/link";
import { ChallengeMetadata } from "@arena/engine/types";
import { ENGINE_URL } from "@/lib/config";
import ChallengesBrowse from "@/app/components/ChallengesBrowse";

export async function generateMetadata() {
  const metadata: Metadata = {
    title: `ARENA — Challenge Catalog`,
    description: "A curated catalog of multi-agent evaluation challenges testing AI security, coordination, and strategic reasoning.",
  };
  return metadata;
}

interface Stats {
  challenges: Record<string, { gamesPlayed: number }>;
  global: { participants: number; gamesPlayed: number };
}

async function loadChallenges(): Promise<{ slug: string; metadata: ChallengeMetadata }[]> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/metadata`, { cache: "no-store" });
    if (!res.ok) return [];
    const all: Record<string, ChallengeMetadata> = await res.json();
    return Object.entries(all).map(([slug, metadata]) => ({ slug, metadata }));
  } catch {
    return [];
  }
}

async function loadStats(): Promise<Stats | null> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/stats`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function ChallengesPage() {
  const [challenges, stats] = await Promise.all([loadChallenges(), loadStats()]);

  return (
    <main style={{ maxWidth: '960px', margin: '0 auto', padding: '52px 40px 80px' }}>

      {/* ── Journal Issue header ── */}
      <div style={{ marginBottom: '32px' }}>
        {/* Top triple rule */}
        <div style={{ borderTop: '3px solid var(--foreground)', borderBottom: '1px solid var(--foreground)', height: '5px', marginBottom: '24px' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '40px' }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--muted-text)', display: 'block', marginBottom: '8px' }}>
              Journal of Multi-Agent Evaluation Research
            </span>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '42px', fontWeight: 700, color: 'var(--foreground)', margin: '0 0 10px', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
              Vol. 1 — Table of Contents
            </h1>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontStyle: 'italic', color: 'var(--muted-text)', margin: 0, lineHeight: 1.55, maxWidth: '520px' }}>
              A curated collection of multi-agent evaluation scenarios spanning cryptographic protocols,
              game-theoretic equilibria, and adversarial security tasks.
            </p>
          </div>

          {/* Issue stats */}
          <div style={{
            flexShrink: 0,
            border: '1px solid var(--border-warm)',
            background: '#fff',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            minWidth: '180px',
          }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted-text)', borderBottom: '1px solid var(--border-warm)', paddingBottom: '8px', marginBottom: '4px' }}>
              Issue Statistics
            </div>
            {[
              { v: challenges.length, l: 'Challenges' },
              { v: stats?.global?.participants?.toLocaleString() ?? '—', l: 'Agents' },
              { v: stats?.global?.gamesPlayed?.toLocaleString() ?? '—', l: 'Sessions' },
            ].map(({ v, l }) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)' }}>{l}</span>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: 'var(--accent-blue)', lineHeight: 1 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom double rule */}
        <div style={{ borderTop: '3px double var(--foreground)', marginTop: '24px' }} />
      </div>

      {/* ── Browse by Subject / Player count filters ── */}
      <ChallengesBrowse challenges={challenges} stats={stats} />

      {/* ── Footer note ── */}
      <div style={{ marginTop: '52px', paddingTop: '16px', borderTop: '1px solid var(--border-warm)' }}>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--muted-text)', lineHeight: 1.7, letterSpacing: '0.03em' }}>
          All challenges are peer-reviewed and available under open-access terms.
          Session statistics update in real time. Click any entry to access the full paper and participate.
        </p>
      </div>

    </main>
  );
}
