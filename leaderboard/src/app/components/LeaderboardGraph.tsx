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

    // Group nearby points into clusters to avoid overlapping labels
    const pixelsPerUnitX = (width - 20) / 2; // domain [-1,1] = 2 units, minus inset
    const pixelsPerUnitY = (height - 20) / 2;
    const clusterThresholdPx = 40; // points within this pixel distance get grouped

    const clusters: { points: typeof labeled; x: number; y: number }[] = [];
    for (const point of labeled) {
      const px = point.securityPolicy * pixelsPerUnitX;
      const py = point.utility * pixelsPerUnitY;
      let merged = false;
      for (const cluster of clusters) {
        const dist = Math.hypot(px - cluster.x, py - cluster.y);
        if (dist < clusterThresholdPx) {
          cluster.points.push(point);
          // Update cluster center
          cluster.x = cluster.points.reduce((s, p) => s + p.securityPolicy * pixelsPerUnitX, 0) / cluster.points.length;
          cluster.y = cluster.points.reduce((s, p) => s + p.utility * pixelsPerUnitY, 0) / cluster.points.length;
          merged = true;
          break;
        }
      }
      if (!merged) {
        clusters.push({ points: [point], x: px, y: py });
      }
    }

    // Build label positions from clusters
    const labelPositions = clusters.map((cluster) => {
      // Pick the best point (prefer pareto frontier) as the representative
      const rep = cluster.points.find((p) => paretoSet.has(p.name)) || cluster.points[0];
      const others = cluster.points.length - 1;
      const label = others > 0 ? `${rep.name} +${others}` : rep.name;
      const anchor: "end" | "start" | "middle" = rep.securityPolicy > 0.5 ? "end" : rep.securityPolicy < -0.5 ? "start" : "middle";
      const dxVal = anchor === "end" ? -8 : anchor === "start" ? 8 : 0;
      return {
        ...rep,
        text: label,
        dx: dxVal,
        dy: -12,
        anchor,
        isPareto: paretoSet.has(rep.name),
      };
    });

    // Remove overlapping labels: pareto labels take priority, then earlier in list
    const charW = 6.5; // approx px per char at fontSize 11
    const labelH = 14;
    const getBBox = (lbl: typeof labelPositions[0]) => {
      const cx = lbl.securityPolicy * pixelsPerUnitX + lbl.dx;
      const cy = -(lbl.utility * pixelsPerUnitY) + lbl.dy; // y is inverted in screen coords
      const tw = lbl.text.length * charW;
      let x0: number;
      if (lbl.anchor === "end") x0 = cx - tw;
      else if (lbl.anchor === "start") x0 = cx;
      else x0 = cx - tw / 2;
      return { x0, x1: x0 + tw, y0: cy - labelH / 2, y1: cy + labelH / 2 };
    };
    const overlaps = (a: ReturnType<typeof getBBox>, b: ReturnType<typeof getBBox>) =>
      a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

    // Sort: pareto first, then by x position (left to right spread)
    const sorted = [...labelPositions].sort((a, b) => {
      if (a.isPareto !== b.isPareto) return a.isPareto ? -1 : 1;
      return a.securityPolicy - b.securityPolicy;
    });
    const visibleLabels: typeof labelPositions = [];
    for (const lbl of sorted) {
      const box = getBBox(lbl);
      if (!visibleLabels.some((kept) => overlaps(box, getBBox(kept)))) {
        visibleLabels.push(lbl);
      }
    }

    const chart = Plot.plot({
      width: width,
      height: height,
      grid: false,
      style: {
        color: "#18181b",
        fontFamily: "var(--font-jost), Jost, sans-serif",
      },
      marginBottom: 40,
      x: {
        label: "Security",
        domain: [-1, 1],
        ticks: [-1, 0, 1],
        tickFormat: (d: number) => String(d),
        inset: 10,
      },
      y: {
        label: "Utility",
        domain: [-1, 1],
        ticks: [-1, 0, 1],
        tickFormat: (d: number) => String(d),
        inset: 10,
      },
      marks: [
        // Grid lines constrained to [-1, 1]
        Plot.gridX([-1, 0, 1], { y1: -1, y2: 1 }),
        Plot.gridY([-1, 0, 1], { x1: -1, x2: 1 }),
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
        // Labels (clustered, with non-pareto hidden if overlapping pareto)
        ...visibleLabels.map((d) => {
          return Plot.text([d], {
            x: "securityPolicy",
            y: "utility",
            text: "text",
            dx: d.dx,
            dy: d.dy,
            fontSize: 11,
            fill: d.isPareto ? "#000" : "#a1a1aa",
            fontWeight: "600",
            textAnchor: d.anchor,
          });
        }),
      ],
    });

    container.appendChild(chart);

    // Style the chart to ensure axis labels and ticks are visible
    const svg = container.querySelector("svg");
    if (svg) {
      // Set font on all text, but only override fill on axis text (not data labels)
      svg.querySelectorAll("text").forEach((text) => {
        (text as SVGTextElement).setAttribute("font-family", "var(--font-jost), Jost, sans-serif");
      });
      svg.querySelectorAll("[aria-label*='axis'] text").forEach((text) => {
        (text as SVGTextElement).setAttribute("fill", "#18181b");
      });
      // Bump axis label font size
      svg.querySelectorAll("[aria-label='x-axis label'], [aria-label='y-axis label']").forEach((label) => {
        const text = label.querySelector("text");
        if (text) (text as SVGTextElement).setAttribute("font-size", "13");
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
