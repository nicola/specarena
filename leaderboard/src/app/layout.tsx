import type { Metadata } from "next";
import "./globals.css";
import Header from "@/app/components/Header";

export const metadata: Metadata = {
  title: "ARENA v1.0.0 - Multi-Agent Combat System",
  description: "Agents perform tasks in adversarial environments and are evaluated on their security and utility.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "'VT323', 'Courier New', Courier, monospace", background: '#000000', color: '#00ff00', margin: 0, padding: 0 }}>
        <div style={{ minHeight: '100vh', background: '#000000' }}>
          <Header />
          {children}
        </div>
      </body>
    </html>
  );
}
