"use client";

import { useEffect, useRef, useState } from "react";
import * as Plot from "@observablehq/plot";

interface LeaderboardData {
  name: string;
  dimensions: Record<string, number>;
  model?: string;
  isBenchmark?: boolean;
}

interface LeaderboardGraphProps {
  data?: LeaderboardData[];
  height?: number;
  highlightName?: string;
  axes?: { x?: string; y?: string };
}

export default function LeaderboardGraph({ data = [], height = 400, highlightName, axes }: LeaderboardGraphProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  // Determine axis dimensions from axes prop or infer from data
  const allDims = new Set<string>();
  for (const d of data) {
    for (const k of Object.keys(d.dimensions)) allDims.add(k);
  }
  const dimList = Array.from(allDims);

  const yDim = axes?.y ?? "utility";
  const xDim = axes ? axes.x : (dimList.find(d => d !== yDim) || undefined);
  const isScatter = !!xDim;

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

    if (isScatter) {
      renderScatter(container);
    } else {
      renderBarChart(container);
    }

    // Style the chart
    const svg = container.querySelector("svg");
    if (svg) {
      svg.querySelectorAll("text").forEach((text) => {
        (text as SVGTextElement).setAttribute("font-family", "var(--font-jost), Jost, sans-serif");
      });
      svg.querySelectorAll("[aria-label*='axis'] text").forEach((text) => {
        (text as SVGTextElement).setAttribute("fill", "#18181b");
      });
      svg.querySelectorAll("[aria-label='x-axis label'], [aria-label='y-axis label']").forEach((label) => {
        const text = label.querySelector("text");
        if (text) (text as SVGTextElement).setAttribute("font-size", "13");
      });
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
  }, [width, height, data, highlightName, xDim, yDim, isScatter]);

  function renderScatter(container: HTMLDivElement) {
    const xLabel = capitalize(xDim!);
    const yLabel = capitalize(yDim);

    // Compute Pareto frontier
    const paretoSet = new Set<string>();
    for (const point of data) {
      const px = point.dimensions[xDim!] ?? 0;
      const py = point.dimensions[yDim] ?? 0;
      const dominated = data.some((other) => {
        if (other === point) return false;
        const ox = other.dimensions[xDim!] ?? 0;
        const oy = other.dimensions[yDim] ?? 0;
        return ox >= px && oy >= py && (ox > px || oy > py);
      });
      if (!dominated) paretoSet.add(point.name);
    }

    const frontierPoints = data
      .filter((d) => paretoSet.has(d.name))
      .sort((a, b) => (b.dimensions[xDim!] ?? 0) - (a.dimensions[xDim!] ?? 0) || (b.dimensions[yDim] ?? 0) - (a.dimensions[yDim] ?? 0));

    const highlightSet = new Set<string>();
    if (highlightName) highlightSet.add(highlightName);

    const labelSet = new Set(paretoSet);
    if (highlightName) labelSet.add(highlightName);

    for (const point of data) {
      if (labelSet.has(point.name)) continue;
      let minDist = Infinity;
      for (const fp of frontierPoints) {
        const dist = Math.hypot(
          (fp.dimensions[xDim!] ?? 0) - (point.dimensions[xDim!] ?? 0),
          (fp.dimensions[yDim] ?? 0) - (point.dimensions[yDim] ?? 0)
        );
        minDist = Math.min(minDist, dist);
      }
      if (minDist <= 0.5) labelSet.add(point.name);
    }

    const labeled = data.filter((d) => labelSet.has(d.name));

    const pixelsPerUnitX = (width - 20) / 2;
    const pixelsPerUnitY = (height - 20) / 2;
    const clusterThresholdPx = 40;

    const clusters: { points: typeof labeled; x: number; y: number }[] = [];
    for (const point of labeled) {
      const px = (point.dimensions[xDim!] ?? 0) * pixelsPerUnitX;
      const py = (point.dimensions[yDim] ?? 0) * pixelsPerUnitY;
      let merged = false;
      for (const cluster of clusters) {
        const dist = Math.hypot(px - cluster.x, py - cluster.y);
        if (dist < clusterThresholdPx) {
          cluster.points.push(point);
          cluster.x = cluster.points.reduce((s, p) => s + (p.dimensions[xDim!] ?? 0) * pixelsPerUnitX, 0) / cluster.points.length;
          cluster.y = cluster.points.reduce((s, p) => s + (p.dimensions[yDim] ?? 0) * pixelsPerUnitY, 0) / cluster.points.length;
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
      const xVal = rep.dimensions[xDim!] ?? 0;
      const anchor: "end" | "start" | "middle" = xVal > 0.5 ? "end" : xVal < -0.5 ? "start" : "middle";
      const dxVal = anchor === "end" ? -8 : anchor === "start" ? 8 : 0;
      return {
        ...rep,
        _x: xVal,
        _y: rep.dimensions[yDim] ?? 0,
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
      const cx = lbl._x * pixelsPerUnitX + lbl.dx;
      const cy = -(lbl._y * pixelsPerUnitY) + lbl.dy;
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
      return a._x - b._x;
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
        color: "#18181b",
        fontFamily: "var(--font-jost), Jost, sans-serif",
      },
      marginBottom: 40,
      x: {
        label: xLabel,
        domain: [-1, 1],
        ticks: [-1, 0, 1],
        tickFormat: (d: number) => String(d),
        inset: 10,
      },
      y: {
        label: yLabel,
        domain: [-1, 1],
        ticks: [-1, 0, 1],
        tickFormat: (d: number) => String(d),
        inset: 10,
      },
      marks: [
        Plot.gridX([-1, 0, 1], { y1: -1, y2: 1 }),
        Plot.gridY([-1, 0, 1], { x1: -1, x2: 1 }),
        Plot.dot(data.filter((d) => !highlightSet.has(d.name)), {
          x: (d: LeaderboardData) => d.dimensions[xDim!] ?? 0,
          y: (d: LeaderboardData) => d.dimensions[yDim] ?? 0,
          fill: (d) => d.isBenchmark ? "#f59e0b" : paretoSet.has(d.name) ? "#000" : "#a1a1aa",
          r: (d) => paretoSet.has(d.name) ? 7 : d.isBenchmark ? 6 : 5,
          stroke: (d) => d.isBenchmark ? "#d97706" : "none",
          strokeWidth: (d) => d.isBenchmark ? 1.5 : 0,
          ...dotTipOptions,
        }),
        ...highlightSet.size > 0 ? [Plot.dot(data.filter((d) => highlightSet.has(d.name)), {
          x: (d: LeaderboardData) => d.dimensions[xDim!] ?? 0,
          y: (d: LeaderboardData) => d.dimensions[yDim] ?? 0,
          fill: "#6366f1",
          r: 7,
          stroke: "#4f46e5",
          strokeWidth: 2,
          ...dotTipOptions,
        })] : [],
        ...visibleLabels.map((d) => {
          return Plot.text([d], {
            x: "_x",
            y: "_y",
            text: "text",
            dx: d.dx,
            dy: d.dy,
            fontSize: 11,
            fill: d.isHighlight ? "#6366f1" : d.isBenchmark ? "#f59e0b" : d.isPareto ? "#000" : "#a1a1aa",
            fontWeight: "600",
            textAnchor: d.anchor,
          });
        }),
      ],
    });

    container.appendChild(chart);
  }

  function renderBarChart(container: HTMLDivElement) {
    const label = capitalize(yDim);
    const sorted = [...data].sort((a, b) => (b.dimensions[yDim] ?? 0) - (a.dimensions[yDim] ?? 0));

    const highlightSet = new Set<string>();
    if (highlightName) highlightSet.add(highlightName);

    const chart = Plot.plot({
      width: width,
      height: Math.max(height, sorted.length * 28 + 60),
      marginLeft: 100,
      marginRight: 40,
      style: {
        color: "#18181b",
        fontFamily: "var(--font-jost), Jost, sans-serif",
      },
      x: {
        label: label,
        domain: [-1, 1],
        grid: true,
      },
      y: {
        label: null,
        domain: sorted.map(d => d.name),
        padding: 0.2,
      },
      marks: [
        Plot.barX(sorted, {
          x: (d: LeaderboardData) => d.dimensions[yDim] ?? 0,
          y: "name",
          fill: (d: LeaderboardData) =>
            highlightSet.has(d.name) ? "#6366f1"
            : d.isBenchmark ? "#f59e0b"
            : "#18181b",
          tip: {
            channels: {
              model: { value: (d: LeaderboardData) => d.model ?? "—", label: "Model" },
            },
            format: {
              model: true,
              x: true,
              y: false,
              fill: false,
            },
          },
        }),
      ],
    });

    container.appendChild(chart);
  }

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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
