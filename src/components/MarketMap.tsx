"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { formatPct } from "@/lib/format";

interface MapEntry {
  symbol: string;
  companyName: string;
  score: number;
  priceChangePct: number;
  classification: string;
}

interface MarketMapProps {
  entries: MapEntry[];
  watchlistId: string;
}

// Nodes are laid out on a deterministic spiral (seeded by symbol) so the
// same watchlist always renders in the same arrangement across refreshes —
// re-layout would be disorienting for something users check regularly.
// Radius from the center is inverse to attention score (high-attention
// stocks pull toward the center and grow), so "where should I look" reads
// spatially without needing every card read individually.
function layout(entries: MapEntry[], width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(width, height) / 2 - 60;

  return entries.map((e, i) => {
    const angle = (i / Math.max(entries.length, 1)) * Math.PI * 2 + i * 0.6;
    const normalizedScore = e.score / 100;
    const r = maxR * (1 - normalizedScore * 0.72) * (0.55 + 0.45 * ((i % 3) / 2));
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r * 0.72; // flatten vertically for a widescreen feel
    const size = 26 + normalizedScore * 46;
    return { ...e, x, y, size };
  });
}

const GLOW_BY_CLASS: Record<string, string> = {
  HIGH_ATTENTION: "#0BE39F",
  IMPORTANT: "#5B6EF5",
  INTERESTING: "#FF9B2E",
  NORMAL: "#3A4150",
};

export function MarketMap({ entries, watchlistId }: MarketMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const width = 900;
  const height = 460;
  const nodes = useMemo(() => layout(entries, width, height), [entries]);

  return (
    <div className="glass relative overflow-hidden rounded-2xl p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[340px] w-full sm:h-[420px]" role="img" aria-label="Market map of your watchlist, sized by attention score">
        {/* faint connective rings for depth */}
        {[0.35, 0.6, 0.85].map((f) => (
          <circle
            key={f}
            cx={width / 2}
            cy={height / 2}
            r={Math.min(width, height) * 0.5 * f - 20}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={1}
          />
        ))}

        {nodes.map((node, i) => {
          const color = GLOW_BY_CLASS[node.classification] ?? GLOW_BY_CLASS.NORMAL;
          const isHovered = hovered === node.symbol;
          const positive = node.priceChangePct >= 0;
          return (
            <g key={node.symbol}>
              {node.classification === "HIGH_ATTENTION" && (
                <circle cx={node.x} cy={node.y} r={node.size} fill={color} opacity={0.35} className="origin-center animate-ripple" style={{ transformOrigin: `${node.x}px ${node.y}px` }} />
              )}
              <motion.circle
                cx={node.x}
                cy={node.y}
                r={node.size}
                fill={color}
                fillOpacity={node.classification === "NORMAL" ? 0.12 : 0.22}
                stroke={color}
                strokeWidth={isHovered ? 2.5 : 1.4}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.05, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className={node.classification === "HIGH_ATTENTION" ? "animate-pulse-node" : ""}
                style={{ cursor: "pointer", transformOrigin: `${node.x}px ${node.y}px` }}
                onMouseEnter={() => setHovered(node.symbol)}
                onMouseLeave={() => setHovered(null)}
              />
              <text
                x={node.x}
                y={node.y + 4}
                textAnchor="middle"
                className="pointer-events-none select-none"
                fill="#fff"
                fillOpacity={0.85}
                fontSize={Math.max(10, node.size / 3.4)}
                fontFamily="var(--font-mono)"
                fontWeight={600}
              >
                {node.symbol}
              </text>
              {!isHovered && (
                <text
                  x={node.x}
                  y={node.y + node.size + 16}
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                  fill={positive ? "#3DF0B8" : "#FF6B81"}
                  fontSize={11}
                  fontFamily="var(--font-mono)"
                >
                  {formatPct(node.priceChangePct)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <AnimatePresence>
        {hovered &&
          (() => {
            const node = nodes.find((n) => n.symbol === hovered);
            if (!node) return null;
            return (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="glass pointer-events-none absolute z-10 rounded-xl px-3 py-2 text-xs"
                style={{
                  left: `${(node.x / width) * 100}%`,
                  top: `${(node.y / height) * 100}%`,
                  transform: "translate(-50%, -140%)",
                }}
              >
                <p className="font-semibold text-white">{node.companyName}</p>
                <p className="text-white/50">
                  Attention {node.score} · {formatPct(node.priceChangePct)}
                </p>
              </motion.div>
            );
          })()}
      </AnimatePresence>

      <p className="mt-2 px-2 text-[11px] text-white/30">
        Node size and pull toward the center reflect Attention Score. Click a node to open its detail view.
      </p>

      {/* invisible click targets layered via HTML for real navigation + a11y */}
      <div className="pointer-events-none absolute inset-4 grid grid-cols-1">
        {nodes.map((node) => (
          <Link
            key={node.symbol}
            href={`/stock/${node.symbol}?watchlistId=${watchlistId}`}
            aria-label={`Open ${node.companyName} detail`}
            className="pointer-events-auto absolute rounded-full"
            style={{
              left: `${(node.x / width) * 100}%`,
              top: `${(node.y / height) * 100}%`,
              width: (node.size * 2 * width) / 900 / 4,
              height: (node.size * 2 * width) / 900 / 4,
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
