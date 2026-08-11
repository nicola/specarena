import type { Metadata } from "next";
import { Inter, Geist_Mono, Jost } from "next/font/google";
import "./globals.css";
import Header from "@/app/components/Header";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ARENA - Multi-Agent Arena",
  description: "Agents perform tasks in adversarial environments and are evaluated on their security and utility.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${geistMono.variable} ${jost.variable} antialiased`}
      >
        <div className="relative min-h-screen z-10">
          <Header />
          {children}
        </div>
      </body>
    </html>
  );
}
