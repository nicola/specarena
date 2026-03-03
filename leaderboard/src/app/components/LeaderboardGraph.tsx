"use client";

import { useEffect, useRef, useState } from "react";
import * as Plot from "@observablehq/plot";

interface LeaderboardData {
  name: string;
  securityPolicy: number;
  utility: number;
  model?: string;
}

interface LeaderboardGraphProps {
  data?: LeaderboardData[];
  height?: number;
}

// Mock leaderboard data (scores in [-2, 2] range)
const mockData: LeaderboardData[] = [
  { name: "Alpha", securityPolicy: 0.35, utility: 0.8 },
  { name: "Beta", securityPolicy: 0.1, utility: 0.5 },
  { name: "Gamma", securityPolicy: 0.6, utility: -0.2 },
  { name: "Delta", securityPolicy: -0.3, utility: 0.9 },
  { name: "Epsilon", securityPolicy: 0.5, utility: 0.2 },
  { name: "Zeta", securityPolicy: -0.1, utility: 0.65 },
  { name: "Eta", securityPolicy: 0.7, utility: -0.4 },
  { name: "Theta", securityPolicy: -0.4, utility: 0.3 },
  { name: "Iota", securityPolicy: 0.25, utility: 0.55 },
  { name: "Kappa", securityPolicy: 0.0, utility: 0.25 },
  { name: "Lambda", securityPolicy: 0.55, utility: 0.35 },
  { name: "Mu", securityPolicy: -0.2, utility: 0.75 },
  { name: "Nu", securityPolicy: 0.15, utility: 0.1 },
  { name: "Xi", securityPolicy: -0.5, utility: 0.5 },
  { name: "Omicron", securityPolicy: 0.45, utility: 0.7 },
];

export default function LeaderboardGraph({ data = mockData, height = 400 }: LeaderboardGraphProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    const container = plotRef.current;
    if (!container) return;

    const updateWidth = () => {
      const containerWidth = container.parentElement?.clientWidth || 800;
      const availableWidth = Math.max(400, containerWidth);
      setWidth(availableWidth);
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });

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

    container.innerHTML = "";

    // Compute Pareto frontier: points not dominated in both security AND utility
    const paretoSet = new Set<string>();
    for (const point of data) {
      const dominated = data.some(
        (other) =>
          other !== point &&
          other.securityPolicy >= point.securityPolicy &&
          other.utility >= point.utility &&
          (other.securityPolicy > point.securityPolicy || other.utility > point.utility)
      );
      if (!dominated) paretoSet.add(point.name);
    }

    // Label frontier points + near-frontier points
    // For each non-frontier point, measure how far it is from the frontier line.
    // The frontier forms a staircase; distance = min over frontier segments.
    const frontierPoints = data
      .filter((d) => paretoSet.has(d.name))
      .sort((a, b) => b.securityPolicy - a.securityPolicy || b.utility - a.utility);

    const labelSet = new Set(paretoSet);

    // Compute how "dominated" each non-frontier point is:
    // the smallest amount any frontier point beats it by in BOTH dimensions
    for (const point of data) {
      if (labelSet.has(point.name)) continue;
      // Find the closest frontier point by Euclidean distance
      let minDist = Infinity;
      for (const fp of frontierPoints) {
        const dist = Math.hypot(
          fp.securityPolicy - point.securityPolicy,
          fp.utility - point.utility
        );
        minDist = Math.min(minDist, dist);
      }
      // Label if within 0.5 score units of any frontier point
      if (minDist <= 0.5) {
        labelSet.add(point.name);
      }
    }

    const labeled = data.filter((d) => labelSet.has(d.name));
    const labelPositions = labeled.map((d) => ({
      ...d,
      dx: 0,
      dy: -12,
    }));

    // Simple overlap avoidance: sort by position and nudge colliding labels
    const pixelsPerUnitX = width / 3; // domain is [-1.5,1.5] = 3 units
    const pixelsPerUnitY = height / 3;
    const minDistPx = 14; // min vertical pixel distance between labels

    labelPositions.sort((a, b) => {
      const ax = a.securityPolicy * pixelsPerUnitX;
      const ay = a.utility * pixelsPerUnitY;
      const bx = b.securityPolicy * pixelsPerUnitX;
      const by = b.utility * pixelsPerUnitY;
      return ax - bx || by - ay;
    });

    for (let i = 1; i < labelPositions.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = labelPositions[j];
        const b = labelPositions[i];
        const dxPx = Math.abs(
          (b.securityPolicy - a.securityPolicy) * pixelsPerUnitX + b.dx - a.dx
        );
        const dyPx = Math.abs(
          (b.utility - a.utility) * pixelsPerUnitY + b.dy - a.dy
        );
        if (dxPx < 60 && dyPx < minDistPx) {
          b.dy = a.dy - minDistPx;
        }
      }
    }

    const chart = Plot.plot({
      width: width,
      height: height,
      grid: true,
      style: {
        color: "#18181b",
        fontFamily: "var(--font-jost), Jost, sans-serif",
      },
      x: {
        label: "Security",
        domain: [-1.5, 1.5],
        ticks: [-1, 0, 1],
      },
      y: {
        label: "Utility",
        domain: [-1.5, 1.5],
        ticks: [-1, 0, 1],
      },
      marks: [
        // All points as dots
        Plot.dot(data, {
          x: "securityPolicy",
          y: "utility",
          fill: (d) => paretoSet.has(d.name) ? "#000" : "#a1a1aa",
          r: (d) => paretoSet.has(d.name) ? 5 : 3,
          channels: {
            name: { value: "name", label: "Name" },
            model: { value: (d) => d.model ?? "—", label: "Model" },
          },
          tip: {
            format: {
              name: true,
              model: true,
              x: true,
              y: true,
              fill: false,
              r: false,
            },
          },
        }),
        // Labels only for Pareto frontier points
        ...labelPositions.map((d) =>
          Plot.text([d], {
            x: "securityPolicy",
            y: "utility",
            text: "name",
            dx: d.dx,
            dy: d.dy,
            fontSize: 10,
            fill: "#000",
            fontWeight: "600",
            textAnchor: "middle",
          })
        ),
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
  }, [width, height, data]);

  return (
    <div className="flex justify-center overflow-x-auto">
      <div ref={plotRef} className="plot-container" />
    </div>
  );
}
