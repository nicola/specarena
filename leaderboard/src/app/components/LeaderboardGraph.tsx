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

export default function LeaderboardGraph({ data = [], height = 400, highlightName }: LeaderboardGraphProps) {
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

    // Chinese Ink palette
    const inkBlack = "#1a1008";
    const vermillion = "#cc2200";
    const warmBrown = "#8b4513";
    const gridLine = "#d4c4a8";

    const chart = Plot.plot({
      width: width,
      height: height,
      grid: false,
      style: {
        color: inkBlack,
        fontFamily: "var(--font-noto-serif), serif",
        background: "transparent",
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
        Plot.gridX([-1, 0, 1], { y1: -1, y2: 1, stroke: gridLine }),
        Plot.gridY([-1, 0, 1], { x1: -1, x2: 1, stroke: gridLine }),
        // Non-highlighted points
        Plot.dot(data.filter((d) => !highlightSet.has(d.name)), {
          x: "securityPolicy",
          y: "utility",
          fill: (d) => d.isBenchmark ? "#c4872a" : paretoSet.has(d.name) ? inkBlack : warmBrown,
          r: (d) => paretoSet.has(d.name) ? 7 : d.isBenchmark ? 6 : 5,
          stroke: (d) => d.isBenchmark ? "#8b5e1a" : "none",
          strokeWidth: (d) => d.isBenchmark ? 1.5 : 0,
          fillOpacity: (d) => paretoSet.has(d.name) ? 1 : 0.55,
          ...dotTipOptions,
        }),
        // Highlighted point
        ...highlightSet.size > 0 ? [Plot.dot(data.filter((d) => highlightSet.has(d.name)), {
          x: "securityPolicy",
          y: "utility",
          fill: vermillion,
          r: 8,
          stroke: "#8b1500",
          strokeWidth: 1.5,
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
            fontSize: 11,
            fill: d.isHighlight ? vermillion : d.isBenchmark ? "#c4872a" : d.isPareto ? inkBlack : warmBrown,
            fontWeight: "600",
            textAnchor: d.anchor,
          });
        }),
      ],
    });

    container.appendChild(chart);

    const svg = container.querySelector("svg");
    if (svg) {
      svg.querySelectorAll("text").forEach((text) => {
        (text as SVGTextElement).setAttribute("font-family", "var(--font-noto-serif), serif");
      });
      svg.querySelectorAll("[aria-label*='axis'] text").forEach((text) => {
        (text as SVGTextElement).setAttribute("fill", inkBlack);
      });
      svg.querySelectorAll("[aria-label='x-axis label'], [aria-label='y-axis label']").forEach((label) => {
        const text = label.querySelector("text");
        if (text) (text as SVGTextElement).setAttribute("font-size", "13");
      });
      const lineElements = svg.querySelectorAll("line");
      lineElements.forEach((line) => {
        const stroke = (line as SVGLineElement).getAttribute("stroke");
        if (stroke && (stroke === "currentColor" || stroke === "white" || !stroke)) {
          (line as SVGLineElement).setAttribute("stroke", gridLine);
        }
      });
    }

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [width, height, data, highlightName]);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-zinc-400 text-sm"
        style={{ height }}
      >
        No games played yet. Complete a challenge to appear on the leaderboard.
      </div>
    );
  }

  return (
    <div className="flex justify-center overflow-x-auto" style={{ background: 'transparent' }}>
      <div ref={plotRef} className="plot-container" />
    </div>
  );
}
