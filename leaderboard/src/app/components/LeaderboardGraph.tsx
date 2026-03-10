"use client";

import { useEffect, useRef, useState } from "react";
import * as Plot from "@observablehq/plot";

interface LeaderboardData {
  name: string;
  securityPolicy: number;
  utility: number;
  model?: string;
  isBenchmark?: boolean;
}

interface LeaderboardGraphProps {
  data?: LeaderboardData[];
  height?: number;
  highlightName?: string;
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

export default function LeaderboardGraph({ data = mockData, height = 400, highlightName }: LeaderboardGraphProps) {
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

    // Compute Pareto frontier
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

    const frontierPoints = data
      .filter((d) => paretoSet.has(d.name))
      .sort((a, b) => b.securityPolicy - a.securityPolicy || b.utility - a.utility);

    const highlightSet = new Set<string>();
    if (highlightName) highlightSet.add(highlightName);

    const labelSet = new Set(paretoSet);
    if (highlightName) labelSet.add(highlightName);

    for (const point of data) {
      if (labelSet.has(point.name)) continue;
      let minDist = Infinity;
      for (const fp of frontierPoints) {
        const dist = Math.hypot(
          fp.securityPolicy - point.securityPolicy,
          fp.utility - point.utility
        );
        minDist = Math.min(minDist, dist);
      }
      if (minDist <= 0.5) {
        labelSet.add(point.name);
      }
    }

    const labeled = data.filter((d) => labelSet.has(d.name));

    const pixelsPerUnitX = (width - 20) / 2;
    const pixelsPerUnitY = (height - 20) / 2;
    const clusterThresholdPx = 40;

    const clusters: { points: typeof labeled; x: number; y: number }[] = [];
    for (const point of labeled) {
      const px = point.securityPolicy * pixelsPerUnitX;
      const py = point.utility * pixelsPerUnitY;
      let merged = false;
      for (const cluster of clusters) {
        const dist = Math.hypot(px - cluster.x, py - cluster.y);
        if (dist < clusterThresholdPx) {
          cluster.points.push(point);
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

    const labelPositions = clusters.map((cluster) => {
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
        isHighlight: highlightSet.has(rep.name),
        isBenchmark: rep.isBenchmark,
      };
    });

    const charW = 6.5;
    const labelH = 14;
    const getBBox = (lbl: typeof labelPositions[0]) => {
      const cx = lbl.securityPolicy * pixelsPerUnitX + lbl.dx;
      const cy = -(lbl.utility * pixelsPerUnitY) + lbl.dy;
      const tw = lbl.text.length * charW;
      let x0: number;
      if (lbl.anchor === "end") x0 = cx - tw;
      else if (lbl.anchor === "start") x0 = cx;
      else x0 = cx - tw / 2;
      return { x0, x1: x0 + tw, y0: cy - labelH / 2, y1: cy + labelH / 2 };
    };
    const overlaps = (a: ReturnType<typeof getBBox>, b: ReturnType<typeof getBBox>) =>
      a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

    const sorted = [...labelPositions].sort((a, b) => {
      if (a.isHighlight !== b.isHighlight) return a.isHighlight ? -1 : 1;
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

    const dotTipOptions = {
      channels: {
        name: { value: "name", label: "Name" },
        model: { value: (d: LeaderboardData) => d.model ?? "—", label: "Model" },
      },
      tip: {
        format: {
          name: true,
          model: true,
          x: true,
          y: true,
          fill: false,
          r: false,
          strokeWidth: false,
        },
      },
    };

    const chart = Plot.plot({
      width: width,
      height: height,
      grid: false,
      style: {
        color: "#000000",
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        background: "transparent",
      },
      marginBottom: 40,
      x: {
        label: "Security →",
        domain: [-1, 1],
        ticks: [-1, 0, 1],
        tickFormat: (d: number) => String(d),
        inset: 10,
      },
      y: {
        label: "↑ Utility",
        domain: [-1, 1],
        ticks: [-1, 0, 1],
        tickFormat: (d: number) => String(d),
        inset: 10,
      },
      marks: [
        // Grid lines
        Plot.gridX([-1, 0, 1], { y1: -1, y2: 1, stroke: "#e8e8e8", strokeWidth: 1 }),
        Plot.gridY([-1, 0, 1], { x1: -1, x2: 1, stroke: "#e8e8e8", strokeWidth: 1 }),
        // Center axis lines (bolder)
        Plot.gridX([0], { y1: -1, y2: 1, stroke: "#000000", strokeWidth: 1, strokeDasharray: "none" }),
        Plot.gridY([0], { x1: -1, x2: 1, stroke: "#000000", strokeWidth: 1, strokeDasharray: "none" }),
        // Non-highlighted points
        Plot.dot(data.filter((d) => !highlightSet.has(d.name)), {
          x: "securityPolicy",
          y: "utility",
          fill: (d) => d.isBenchmark ? "#e30613" : paretoSet.has(d.name) ? "#000000" : "#767676",
          r: (d) => paretoSet.has(d.name) ? 7 : d.isBenchmark ? 6 : 4,
          stroke: "none",
          ...dotTipOptions,
        }),
        // Highlighted point
        ...highlightSet.size > 0 ? [Plot.dot(data.filter((d) => highlightSet.has(d.name)), {
          x: "securityPolicy",
          y: "utility",
          fill: "#e30613",
          r: 8,
          stroke: "#000000",
          strokeWidth: 2,
          ...dotTipOptions,
        })] : [],
        // Labels
        ...visibleLabels.map((d) => {
          return Plot.text([d], {
            x: "securityPolicy",
            y: "utility",
            text: "text",
            dx: d.dx,
            dy: d.dy,
            fontSize: 10,
            fill: d.isHighlight ? "#e30613" : d.isBenchmark ? "#e30613" : d.isPareto ? "#000000" : "#767676",
            fontWeight: "700",
            textAnchor: d.anchor,
          });
        }),
      ],
    });

    container.appendChild(chart);

    const svg = container.querySelector("svg");
    if (svg) {
      svg.querySelectorAll("text").forEach((text) => {
        (text as SVGTextElement).setAttribute("font-family", '"Helvetica Neue", Helvetica, Arial, sans-serif');
        (text as SVGTextElement).setAttribute("font-size", "11");
      });
      svg.querySelectorAll("[aria-label*='axis'] text").forEach((text) => {
        (text as SVGTextElement).setAttribute("fill", "#000000");
        (text as SVGTextElement).setAttribute("font-weight", "700");
      });
    }

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [width, height, data, highlightName]);

  return (
    <div style={{ display: "flex", justifyContent: "center", overflowX: "auto" }}>
      <div ref={plotRef} />
    </div>
  );
}
