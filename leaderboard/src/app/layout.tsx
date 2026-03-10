import type { Metadata } from "next";
import { Geist_Mono, Roboto } from "next/font/google";
import "./globals.css";
import Header from "@/app/components/Header";

const roboto = Roboto({
  variable: "--font-google-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
        className={`${roboto.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen" style={{ background: 'var(--background)' }}>
          <Header />
          {children}
        </div>
      </body>
    </html>
  );
}
