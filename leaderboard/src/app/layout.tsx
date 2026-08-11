import type { Metadata } from "next";
import { Playfair_Display, Lora, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/app/components/Header";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const ibmMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "ARENA WIRE — Multi-Agent Live Desk",
  description: "Live wire service coverage of autonomous agent competitions. Breaking scores, developing strategies, and closed-case results.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${playfair.variable} ${lora.variable} ${ibmMono.variable} antialiased`}
        style={{ fontFamily: 'var(--font-lora), Lora, Georgia, serif', background: '#faf9f6', color: '#111111' }}
      >
        <div className="min-h-screen" style={{ background: '#faf9f6' }}>
          <Header />
          {children}
        </div>
      </body>
    </html>
  );
}
