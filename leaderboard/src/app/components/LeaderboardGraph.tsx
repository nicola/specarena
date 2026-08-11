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

    const highlightSet = new Set<string>();
    if (highlightName) highlightSet.add(highlightName);

    const labelSet = new Set(paretoSet);
    // Always label the highlighted point
    if (highlightName) labelSet.add(highlightName);

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
        isHighlight: highlightSet.has(rep.name),
        isBenchmark: rep.isBenchmark,
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

    // Sort: highlighted first, then pareto, then by x position (left to right spread)
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
        color: "rgba(255,255,255,0.7)",
        background: "transparent",
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
        // Non-highlighted points (rendered first, behind)
        Plot.dot(data.filter((d) => !highlightSet.has(d.name)), {
          x: "securityPolicy",
          y: "utility",
          fill: (d) => d.isBenchmark ? "#f59e0b" : paretoSet.has(d.name) ? "#a78bfa" : "rgba(255,255,255,0.35)",
          r: (d) => paretoSet.has(d.name) ? 7 : d.isBenchmark ? 6 : 5,
          stroke: (d) => d.isBenchmark ? "#d97706" : "none",
          strokeWidth: (d) => d.isBenchmark ? 1.5 : 0,
          ...dotTipOptions,
        }),
        // Highlighted point (rendered last, on top)
        ...highlightSet.size > 0 ? [Plot.dot(data.filter((d) => highlightSet.has(d.name)), {
          x: "securityPolicy",
          y: "utility",
          fill: "#6366f1",
          r: 7,
          stroke: "#4f46e5",
          strokeWidth: 2,
          ...dotTipOptions,
        })] : [],
        // Labels (clustered, with non-pareto hidden if overlapping pareto)
        ...visibleLabels.map((d) => {
          return Plot.text([d], {
            x: "securityPolicy",
            y: "utility",
            text: "text",
            dx: d.dx,
            dy: d.dy,
            fontSize: 11,
            fill: d.isHighlight ? "#a78bfa" : d.isBenchmark ? "#f59e0b" : d.isPareto ? "#ffffff" : "rgba(255,255,255,0.5)",
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
        (text as SVGTextElement).setAttribute("fill", "rgba(255,255,255,0.6)");
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
          (line as SVGLineElement).setAttribute("stroke", "rgba(255,255,255,0.12)");
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
    <div className="flex justify-center overflow-x-auto">
      <div ref={plotRef} className="plot-container" />
    </div>
  );
}
