import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import Header from "@/app/components/Header";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
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
        className={`${geistMono.variable} ${notoSansJP.variable} antialiased`}
      >
        <div className="min-h-screen bg-white">
          <Header />
          {children}
        </div>
      </body>
    </html>
  );
}
