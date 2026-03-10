"use client";
import { ReactNode } from "react";
import { tagColors } from "@/lib/tagColors";

interface ChallengeCardProps {
  title: string;
  date: string;
  description: string;
  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;
  icon: ReactNode;
  dateColor?: string;
  href: string;
  tags?: string[];
}

export default function ChallengeCard({
  title,
  date,
  description,
  icon,
  href,
  tags,
}: ChallengeCardProps) {
  return (
    <>
      <style>{`
        .brutal-challenge-card {
          display: flex;
          flex-direction: column;
          border: 4px solid #000000;
          background: #ffffff;
          box-shadow: 6px 6px 0 #000000;
          height: 100%;
          transition: none;
        }
        .brutal-challenge-card:hover {
          box-shadow: none;
          transform: translate(6px, 6px);
        }
        .brutal-enter-btn {
          display: block;
          background: #000000;
          color: #f5f5f0;
          border: 3px solid #000000;
          padding: 10px 20px;
          font-family: 'Arial Black', 'Arial', sans-serif;
          font-weight: 900;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          text-decoration: none;
          text-align: center;
          transition: none;
        }
        .brutal-enter-btn:hover {
          background: #ff0000;
          color: #000000;
        }
      `}</style>
      <div className="brutal-challenge-card">
        {/* ICON ZONE — stark black */}
        <div
          style={{
            position: "relative",
            height: "160px",
            background: "#000000",
            borderBottom: "4px solid #000000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          {/* Large background letter for texture */}
          <span
            style={{
              position: "absolute",
              fontFamily: "'Arial Black', 'Arial', sans-serif",
              fontWeight: 900,
              fontSize: "10rem",
              color: "rgba(255,255,255,0.04)",
              lineHeight: 1,
              userSelect: "none",
              right: "-10px",
              bottom: "-20px",
              textTransform: "uppercase",
            }}
          >
            {title.charAt(0)}
          </span>

          {/* Icon in white */}
          <div
            style={{
              width: "80px",
              height: "80px",
              flexShrink: 0,
              filter: "invert(1)",
            }}
          >
            {icon}
          </div>

          {/* Tags */}
          {tags && tags.length > 0 && (
            <div
              style={{
                position: "absolute",
                bottom: "10px",
                left: "10px",
                display: "flex",
                flexWrap: "wrap",
                gap: "4px",
              }}
            >
              {tags.map((tag) => {
                const colors = tagColors[tag] || tagColors._default;
                return (
                  <span
                    key={tag}
                    className={colors}
                    style={{
                      fontSize: "0.6rem",
                      fontFamily: "'Arial Black', 'Arial', sans-serif",
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      padding: "2px 8px",
                    }}
                  >
                    {tag}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* TEXT ZONE */}
        <div
          style={{
            background: "#ffffff",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            flex: 1,
          }}
        >
          {date && (
            <p
              style={{
                fontFamily: "'Arial', sans-serif",
                fontSize: "0.7rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: "#ff0000",
              }}
            >
              {date}
            </p>
          )}

          <h4
            style={{
              fontFamily: "'Arial Black', 'Arial', sans-serif",
              fontWeight: 900,
              fontSize: "1.2rem",
              color: "#000000",
              textTransform: "uppercase",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            {title}
          </h4>

          <p
            style={{
              fontFamily: "'Arial', sans-serif",
              fontSize: "0.8rem",
              color: "#333333",
              lineHeight: 1.5,
              flex: 1,
            }}
          >
            {description}
          </p>

          <a href={href} className="brutal-enter-btn">
            ENTER →
          </a>
        </div>
      </div>
    </>
  );
}
