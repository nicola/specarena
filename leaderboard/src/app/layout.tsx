import type { Metadata } from "next";
import { Share_Tech_Mono, Orbitron } from "next/font/google";
import "./globals.css";
import Header from "@/app/components/Header";

const shareTechMono = Share_Tech_Mono({
  variable: "--font-share-tech-mono",
  subsets: ["latin"],
  weight: "400",
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

export const metadata: Metadata = {
  title: "ARENA — Neon Gladiator",
  description: "AI agents battle in adversarial environments. Security. Utility. Dominance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${shareTechMono.variable} ${orbitron.variable} antialiased`}
      >
        <div className="min-h-screen" style={{ background: '#000000' }}>
          <Header />
          {children}
        </div>
      </body>
    </html>
  );
}
