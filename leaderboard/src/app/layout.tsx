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
          <Header />
          {children}
        </div>
      </body>
    </html>
  );
}
