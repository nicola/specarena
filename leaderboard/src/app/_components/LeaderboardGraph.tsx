"use client";

import { useEffect, useRef, useState } from "react";
import * as Plot from "@observablehq/plot";

interface LeaderboardData {
  name: string;
  securityPolicy: number;
  utility: number;
}

interface LeaderboardGraphProps {
  data?: LeaderboardData[];
}

// Mock leaderboard data
const mockData: LeaderboardData[] = [
  { name: "Alpha", securityPolicy: 85, utility: 92 },
  { name: "Beta", securityPolicy: 78, utility: 88 },
  { name: "Gamma", securityPolicy: 92, utility: 75 },
  { name: "Delta", securityPolicy: 65, utility: 95 },
  { name: "Epsilon", securityPolicy: 88, utility: 82 },
  { name: "Zeta", securityPolicy: 72, utility: 90 },
  { name: "Eta", securityPolicy: 95, utility: 70 },
  { name: "Theta", securityPolicy: 60, utility: 85 },
  { name: "Iota", securityPolicy: 82, utility: 88 },
  { name: "Kappa", securityPolicy: 75, utility: 80 },
  { name: "Lambda", securityPolicy: 90, utility: 85 },
  { name: "Mu", securityPolicy: 68, utility: 92 },
  { name: "Nu", securityPolicy: 80, utility: 78 },
  { name: "Xi", securityPolicy: 55, utility: 88 },
  { name: "Omicron", securityPolicy: 88, utility: 90 },
];

export default function LeaderboardGraph({ data = mockData }: LeaderboardGraphProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    const container = plotRef.current;
    if (!container) return;

    // Function to calculate and update plot width
    const updateWidth = () => {
      const containerWidth = container.parentElement?.clientWidth || 800;
      // Account for padding (p-8 = 2rem = 32px on each side = 64px total)
      const availableWidth = Math.max(400, containerWidth);
      setWidth(availableWidth);
    };

    // Initial width calculation
    updateWidth();

    // Use ResizeObserver to watch for container size changes
    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });

    // Observe the parent container
    if (container.parentElement) {
      resizeObserver.observe(container.parentElement);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const container = plotRef.current;
    if (!container) return;

    // Clear any existing content first
    container.innerHTML = "";

    const chart = Plot.plot({
      width: width,
      height: 400,
      grid: true,
      style: {
        color: "#18181b",
        fontFamily: "var(--font-jost), Jost, sans-serif",
      },
      x: {
        label: "Security Policy",
        domain: [40, 100],
        ticks: 10,
      },
      y: {
        label: "Utility",
        domain: [40, 100],
        ticks: 5,
      },
      marks: [
        Plot.dot(data, {
          x: "securityPolicy",
          y: "utility",
          fill: "#000",
          r: 4,
          tip: {
            format: {
              title: (d) => d.name,
              // x: (d) => `Security Policy: ${d}`,
              // y: (d) => `Utility: ${d}`,
            },
          },
        }),
        Plot.text(data, {
          x: "securityPolicy",
          y: "utility",
          text: "name",
          dx: 0,
          dy: -15,
          fontSize: 10,
          fill: "#000",
          textAnchor: "middle",
        }),
      ],
    });

    container.appendChild(chart);

    // Style the chart to ensure axis labels and ticks are visible
    const svg = container.querySelector("svg");
    if (svg) {
      // Style all text elements (axis labels and tick labels)
      const textElements = svg.querySelectorAll("text");
      textElements.forEach((text) => {
        (text as SVGTextElement).setAttribute("fill", "#18181b");
        (text as SVGTextElement).setAttribute("font-family", "var(--font-jost), Jost, sans-serif");
      });
      // Style all line elements (grid lines and axis lines)
      const lineElements = svg.querySelectorAll("line");
      lineElements.forEach((line) => {
        const stroke = (line as SVGLineElement).getAttribute("stroke");
        if (stroke && (stroke === "currentColor" || stroke === "white" || !stroke)) {
          (line as SVGLineElement).setAttribute("stroke", "#e4e4e7");
        }
      });
    }

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [width, data]);

  return (
    <div className="flex justify-center overflow-x-auto">
      <div ref={plotRef} className="plot-container" />
    </div>
  );
}
