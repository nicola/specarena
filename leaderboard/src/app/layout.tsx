import type { Metadata } from "next";
import "./globals.css";
import Header from "@/app/components/Header";

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
      <body>
        <div style={{ minHeight: "100vh", background: "#ffffff" }}>
          <Header />
          {children}
        </div>
      </body>
    </html>
  );
}
