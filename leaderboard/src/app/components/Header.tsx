"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();

  return (
    <header style={{
      width: "100%",
      background: "#ffffff",
      borderBottom: "2px solid #000000",
      position: "sticky",
      top: 0,
      zIndex: 50,
    }}>
      {/* Red accent bar at very top */}
      <div style={{ height: "4px", background: "#e30613", width: "100%" }} />
      <div style={{
        maxWidth: "1024px",
        margin: "0 auto",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "56px",
      }}>
        {/* Logo */}
        <Link href="/" style={{
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          fontWeight: 700,
          fontSize: "18px",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "#000000",
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}>
          {/* Swiss cross accent */}
          <span style={{
            display: "inline-block",
            width: "16px",
            height: "16px",
            background: "#e30613",
            position: "relative",
            flexShrink: 0,
          }}>
            <span style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "10px",
              height: "2px",
              background: "#ffffff",
            }} />
            <span style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "2px",
              height: "10px",
              background: "#ffffff",
            }} />
          </span>
          Arena
        </Link>

        {/* Navigation */}
        <nav style={{ display: "flex", alignItems: "center", gap: "0" }}>
          {[
            { href: "/", label: "Leaderboard" },
            { href: "/challenges", label: "Challenges" },
            { href: "/docs", label: "Docs" },
          ].map(({ href, label }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link key={href} href={href} style={{
                fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                fontWeight: isActive ? 700 : 400,
                fontSize: "11px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: isActive ? "#e30613" : "#000000",
                textDecoration: "none",
                padding: "8px 16px",
                borderLeft: "1px solid #e8e8e8",
                display: "inline-block",
                transition: "color 0.1s",
              }}>
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
