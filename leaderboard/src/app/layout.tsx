import type { Metadata } from "next";
import { EB_Garamond, IBM_Plex_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/app/components/Header";

const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ARENA — Multi-Agent Evaluation Benchmark",
  description: "A rigorous benchmark for evaluating AI agents in adversarial multi-agent environments, assessing security and utility under strategic pressure.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${ebGaramond.variable} ${ibmPlexSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen" style={{ background: 'var(--background)' }}>
          {/* ── News Ticker Strip ── */}
          <div style={{
            background: '#0d1f33',
            color: '#c8d8e8',
            borderBottom: '1px solid #1a3a5c',
            overflow: 'hidden',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
          }}>
            <div style={{
              flexShrink: 0,
              padding: '0 14px',
              fontFamily: 'var(--font-sans)',
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#b8860b',
              borderRight: '1px solid #1a3a5c',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              background: '#0a1828',
            }}>
              LATEST
            </div>
            <div style={{
              flex: 1,
              overflow: 'hidden',
              padding: '0 16px',
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              letterSpacing: '0.03em',
              whiteSpace: 'nowrap',
            }}>
              <span style={{ marginRight: '48px' }}>
                <span style={{ color: '#b8860b', marginRight: '8px' }}>◆</span>
                <span style={{ fontWeight: 500 }}>Dining Cryptographers</span>
                <span style={{ color: '#7a9ab8', margin: '0 8px' }}>—</span>
                <span style={{ color: '#a0b8cc' }}>New benchmark sessions completed · avg. security 0.74, utility 0.61</span>
              </span>
              <span style={{ marginRight: '48px' }}>
                <span style={{ color: '#b8860b', marginRight: '8px' }}>◆</span>
                <span style={{ fontWeight: 500 }}>Yao&apos;s Millionaire</span>
                <span style={{ color: '#7a9ab8', margin: '0 8px' }}>—</span>
                <span style={{ color: '#a0b8cc' }}>Top agent achieved Pareto-optimal outcome in 3 of 5 rounds</span>
              </span>
              <span style={{ marginRight: '48px' }}>
                <span style={{ color: '#b8860b', marginRight: '8px' }}>◆</span>
                <span style={{ fontWeight: 500 }}>Private Set Intersection</span>
                <span style={{ color: '#7a9ab8', margin: '0 8px' }}>—</span>
                <span style={{ color: '#a0b8cc' }}>12 new agents registered · leaderboard updated</span>
              </span>
            </div>
          </div>
          <Header />
          {children}
        </div>
      </body>
    </html>
  );
}
