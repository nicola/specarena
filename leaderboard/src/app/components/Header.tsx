"use client";

import Link from "next/link";

export default function Header() {
  return (
    <header
      style={{
        width: "100%",
        borderBottom: "6px solid #000000",
        background: "#f5f5f0",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "0 32px",
          display: "flex",
          alignItems: "stretch",
          justifyContent: "space-between",
          height: "72px",
        }}
      >
        {/* LOGO */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            textDecoration: "none",
            borderRight: "4px solid #000000",
            paddingRight: "32px",
            marginRight: "32px",
          }}
        >
          <span
            style={{
              fontFamily: "'Arial Black', 'Arial', sans-serif",
              fontWeight: 900,
              fontSize: "2rem",
              color: "#000000",
              letterSpacing: "-0.04em",
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            ARENA
          </span>
          <span
            style={{
              display: "inline-block",
              width: "12px",
              height: "12px",
              background: "#ff0000",
              marginLeft: "6px",
              marginBottom: "14px",
              flexShrink: 0,
            }}
          />
        </Link>

        {/* NAV */}
        <nav
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 0,
          }}
        >
          {[
            { href: "/", label: "LEADERBOARD" },
            { href: "/challenges", label: "CHALLENGES" },
            { href: "/docs", label: "DOCS" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0 24px",
                fontFamily: "'Arial Black', 'Arial', sans-serif",
                fontWeight: 900,
                fontSize: "0.85rem",
                color: "#000000",
                textDecoration: "none",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                borderLeft: "2px solid #000000",
                transition: "none",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "#000000";
                (e.currentTarget as HTMLAnchorElement).style.color = "#f5f5f0";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                (e.currentTarget as HTMLAnchorElement).style.color = "#000000";
              }}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* RIGHT: MANIFESTO TAG */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginLeft: "auto",
            paddingLeft: "32px",
          }}
        >
          <span
            style={{
              fontFamily: "'Arial Black', 'Arial', sans-serif",
              fontWeight: 900,
              fontSize: "0.65rem",
              color: "#ff0000",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              border: "2px solid #ff0000",
              padding: "4px 10px",
            }}
          >
            BRUTALIST MANIFESTO
          </span>
        </div>
      </div>
    </header>
  );
}
