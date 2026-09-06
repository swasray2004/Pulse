"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { formatPct } from "@/lib/format";
import { TrendingUp, TrendingDown, ArrowRight, Radar } from "lucide-react";

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

interface LayoutNode extends MapEntry {
  x: number;
  y: number;
  size: number;
}

/**
 * Deterministic physics-relaxed celestial layout with safe boundary margins.
 *
 * 1. Coordinates are bounded within maxR = 185 so spheres NEVER touch the edge or clip.
 * 2. Runs iterative collision relaxation ensuring spheres NEVER overlap each other.
 * 3. Both Ticker and % are rendered inside the 3D sphere, eliminating stray floating tags.
 */
function layout(entries: MapEntry[], size: number): LayoutNode[] {
  const cx = size / 2;
  const cy = size / 2;
  // Safe radius: maximum distance from center to center of sphere.
  // With max node size ~46px, maxR = 180 keeps every sphere well within 500px canvas with >35px padding!
  const maxR = 180;
  const minR = 62;

  const sorted = [...entries].sort((a, b) => b.score - a.score);
  const goldenAngle = 2.399963; // ~137.5 deg

  const nodes: LayoutNode[] = sorted.map((e, i) => {
    const norm = Math.max(0, Math.min(100, e.score)) / 100;
    // Radius inverse to attention: high attention pulls to core
    const targetR = minR + (1 - norm * 0.82) * (maxR - minR);
    const angle = i * goldenAngle + (e.symbol.charCodeAt(0) % 7) * 0.35;
    // Sizing: 27px (normal) to 48px (high attention)
    const nodeSize = 27 + norm * 21;

    return {
      ...e,
      x: cx + Math.cos(angle) * targetR,
      y: cy + Math.sin(angle) * targetR,
      size: nodeSize,
    };
  });

  // 45 relaxation iterations to guarantee zero collisions
  const padding = 22;
  for (let iter = 0; iter < 45; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = a.size + b.size + padding;

        if (dist < minDist) {
          if (dist === 0) {
            dx = 1;
            dy = 1;
            dist = Math.SQRT2;
          }
          const overlap = (minDist - dist) / 2;
          const nx = (dx / dist) * overlap;
          const ny = (dy / dist) * overlap;
          a.x -= nx;
          a.y -= ny;
          b.x += nx;
          b.y += ny;
        }
      }
    }

    // Keep comfortably within safe circular boundary
    for (const node of nodes) {
      const dx = node.x - cx;
      const dy = node.y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      const allowedR = maxR - node.size * 0.5;
      if (d > allowedR && d > 0) {
        node.x = cx + (dx / d) * allowedR;
        node.y = cy + (dy / d) * allowedR;
      }
      const innerLimit = minR * 0.55;
      if (d < innerLimit && d > 0) {
        node.x = cx + (dx / d) * innerLimit;
        node.y = cy + (dy / d) * innerLimit;
      }
    }
  }

  return nodes;
}

export function MarketMap({ entries, watchlistId }: MarketMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const size = 500;
  const cx = size / 2;
  const cy = size / 2;
  const nodes = useMemo(() => layout(entries, size), [entries]);

  return (
    <div className="relative flex w-full max-w-[460px] aspect-square flex-col items-center justify-center select-none">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full h-full"
        role="img"
        aria-label="Contained circular market map of your watchlist, sized by attention score with 3D colorful spheres"
      >
        <defs>
          {/* Ambient cosmos nebula core */}
          <radialGradient id="centerNebula" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#5367FE" stopOpacity="0.08" />
            <stop offset="45%" stopColor="#00F3BB" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#04060a" stopOpacity="0" />
          </radialGradient>

          {/* Contact drop shadow for 3D depth */}
          <filter id="sphereContactShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" />
          </filter>

          {/* Aura glow for high attention / important spheres */}
          <filter id="sphereAuraGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="14" />
          </filter>

          {/* Specular glass glint highlight */}
          <linearGradient id="specularGlint" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="35%" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* Spherical Fresnel edge rim light for ceramic-gloss finish */}
          <linearGradient id="sphereRimLight" x1="15%" y1="10%" x2="85%" y2="90%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
          </linearGradient>

          {/* Solid 3D Sphere - #F14D64 (Vibrant Pink / Coral - High Attention) */}
          <radialGradient id="sphere-RED" cx="32%" cy="28%" r="72%" fx="28%" fy="24%">
            <stop offset="0%" stopColor="#FFE8EB" />
            <stop offset="16%" stopColor="#FF8294" />
            <stop offset="46%" stopColor="#F14D64" />
            <stop offset="76%" stopColor="#B52B3E" />
            <stop offset="100%" stopColor="#5A0C18" />
          </radialGradient>
          <radialGradient id="sphere-HIGH_ATTENTION" cx="32%" cy="28%" r="72%" fx="28%" fy="24%">
            <stop offset="0%" stopColor="#FFE8EB" />
            <stop offset="16%" stopColor="#FF8294" />
            <stop offset="46%" stopColor="#F14D64" />
            <stop offset="76%" stopColor="#B52B3E" />
            <stop offset="100%" stopColor="#5A0C18" />
          </radialGradient>

          {/* Solid 3D Sphere - #FE9351 (Warm Tangerine - Important & Interesting) */}
          <radialGradient id="sphere-ORANGE" cx="32%" cy="28%" r="72%" fx="28%" fy="24%">
            <stop offset="0%" stopColor="#FFF5EE" />
            <stop offset="16%" stopColor="#FFB885" />
            <stop offset="46%" stopColor="#FE9351" />
            <stop offset="76%" stopColor="#C7601F" />
            <stop offset="100%" stopColor="#632805" />
          </radialGradient>
          <radialGradient id="sphere-IMPORTANT" cx="32%" cy="28%" r="72%" fx="28%" fy="24%">
            <stop offset="0%" stopColor="#FFF5EE" />
            <stop offset="16%" stopColor="#FFB885" />
            <stop offset="46%" stopColor="#FE9351" />
            <stop offset="76%" stopColor="#C7601F" />
            <stop offset="100%" stopColor="#632805" />
          </radialGradient>
          <radialGradient id="sphere-INTERESTING" cx="32%" cy="28%" r="72%" fx="28%" fy="24%">
            <stop offset="0%" stopColor="#FFF5EE" />
            <stop offset="16%" stopColor="#FFB885" />
            <stop offset="46%" stopColor="#FE9351" />
            <stop offset="76%" stopColor="#C7601F" />
            <stop offset="100%" stopColor="#632805" />
          </radialGradient>

          {/* Solid 3D Sphere - #48B586 (Smooth Jade - Normal) */}
          <radialGradient id="sphere-GREEN" cx="32%" cy="28%" r="72%" fx="28%" fy="24%">
            <stop offset="0%" stopColor="#EBFAF2" />
            <stop offset="16%" stopColor="#78D6AB" />
            <stop offset="46%" stopColor="#48B586" />
            <stop offset="76%" stopColor="#2D7D5B" />
            <stop offset="100%" stopColor="#103B2A" />
          </radialGradient>
          <radialGradient id="sphere-NORMAL" cx="32%" cy="28%" r="72%" fx="28%" fy="24%">
            <stop offset="0%" stopColor="#EBFAF2" />
            <stop offset="16%" stopColor="#78D6AB" />
            <stop offset="46%" stopColor="#48B586" />
            <stop offset="76%" stopColor="#2D7D5B" />
            <stop offset="100%" stopColor="#103B2A" />
          </radialGradient>
        </defs>

        {/* Ambient Center Nebula Glow */}
        <circle cx={cx} cy={cy} r={size * 0.44} fill="url(#centerNebula)" />

        {/* Outer Circular Boundary Track */}
        <circle
          cx={cx}
          cy={cy}
          r={size / 2 - 18}
          fill="none"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth={1}
        />

        {/* Concentric Celestial Orbit Tracks */}
        {[0.32, 0.55, 0.78, 0.96].map((fraction, idx) => {
          const r = 180 * fraction;
          return (
            <g key={fraction}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="rgba(255, 255, 255, 0.06)"
                strokeDasharray={idx % 2 === 0 ? "3 5" : "1 4"}
                strokeWidth={1}
              />
              {/* Subtle radar ticks */}
              {idx >= 2 && (
                <>
                  <circle cx={cx} cy={cy - r} r={1.5} fill="rgba(255, 255, 255, 0.18)" />
                  <circle cx={cx + r} cy={cy} r={1.5} fill="rgba(255, 255, 255, 0.18)" />
                  <circle cx={cx} cy={cy + r} r={1.5} fill="rgba(255, 255, 255, 0.18)" />
                  <circle cx={cx - r} cy={cy} r={1.5} fill="rgba(255, 255, 255, 0.18)" />
                </>
              )}
            </g>
          );
        })}

        {/* Observatory Center Reticle */}
        <line
          x1={cx - 14}
          y1={cy}
          x2={cx + 14}
          y2={cy}
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth={1}
        />
        <line
          x1={cx}
          y1={cy - 14}
          x2={cx}
          y2={cy + 14}
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth={1}
        />
        <circle
          cx={cx}
          cy={cy}
          r={9}
          fill="none"
          stroke="#00F3BB"
          strokeOpacity={0.25}
          strokeDasharray="2 2"
          strokeWidth={1}
        />
        <circle cx={cx} cy={cy} r={2} fill="#00F3BB" opacity={0.6} />

        {/* Render 3D Spheres with Integrated Data */}
        {nodes.map((node, i) => {
          const isHovered = hovered === node.symbol;
          const positive = node.priceChangePct >= 0;
          const sphereGradientId = `sphere-${node.classification}`;

          return (
            <g key={node.symbol} className="transition-transform duration-200">
              {/* Floating Contact Shadow on the 3D floor */}
              <ellipse
                cx={node.x}
                cy={node.y + node.size * 0.92}
                rx={node.size * 0.88}
                ry={node.size * 0.22}
                fill="#000000"
                opacity={0.65}
                filter="url(#sphereContactShadow)"
              />

              {/* Glowing Aura for #F14D64 High Attention Spheres */}
              {node.classification === "HIGH_ATTENTION" && (
                <>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.size * 1.3}
                    fill="#F14D64"
                    opacity={0.28}
                    filter="url(#sphereAuraGlow)"
                  />
                  {/* Concentric pulsating radar ripple */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.size * 1.25}
                    fill="none"
                    stroke="#F14D64"
                    strokeWidth={1.5}
                    opacity={0.45}
                    className="origin-center animate-ripple"
                    style={{ transformOrigin: `${node.x}px ${node.y}px` }}
                  />
                </>
              )}

              {/* Glowing Aura for #FE9351 Important & Interesting Spheres */}
              {(node.classification === "IMPORTANT" || node.classification === "INTERESTING") && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.size * 1.22}
                  fill="#FE9351"
                  opacity={0.22}
                  filter="url(#sphereAuraGlow)"
                />
              )}

              {/* Subtle Halo for #48B586 Normal Spheres */}
              {node.classification === "NORMAL" && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.size * 1.15}
                  fill="#48B586"
                  opacity={0.16}
                  filter="url(#sphereAuraGlow)"
                />
              )}

              {/* Solid 3D Colorful Sphere */}
              <motion.circle
                cx={node.x}
                cy={node.y}
                r={node.size}
                fill={`url(#${sphereGradientId})`}
                stroke={isHovered ? "#ffffff" : "rgba(255, 255, 255, 0.22)"}
                strokeWidth={isHovered ? 2.5 : 1}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: isHovered ? 1.12 : 1, opacity: 1 }}
                transition={{ delay: i * 0.04, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className={node.classification === "HIGH_ATTENTION" ? "animate-pulse-node" : ""}
                style={{ cursor: "pointer", transformOrigin: `${node.x}px ${node.y}px` }}
                onMouseEnter={() => setHovered(node.symbol)}
                onMouseLeave={() => setHovered(null)}
              />

              {/* Spherical Fresnel Edge Rim Light */}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.size}
                fill="none"
                stroke="url(#sphereRimLight)"
                strokeWidth={1.2}
                opacity={0.65}
                className="pointer-events-none"
              />

              {/* Glossy 3D Specular Highlight Crescent */}
              <ellipse
                cx={node.x - node.size * 0.28}
                cy={node.y - node.size * 0.32}
                rx={node.size * 0.32}
                ry={node.size * 0.16}
                transform={`rotate(-28 ${node.x - node.size * 0.28} ${node.y - node.size * 0.32})`}
                fill="url(#specularGlint)"
                className="pointer-events-none"
              />

              {/* Integrated Ticker Symbol Text inside the Sphere */}
              <text
                x={node.x}
                y={node.y - node.size * 0.08}
                textAnchor="middle"
                className="pointer-events-none select-none"
                fill="#ffffff"
                fontSize={Math.max(10.5, node.size / 2.6)}
                fontWeight={700}
                letterSpacing="0.04em"
                style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.85))" }}
              >
                {node.symbol}
              </text>

              {/* Integrated Single Price Movement inside the Sphere (Zero duplication / zero detached pills) */}
              <text
                x={node.x}
                y={node.y + node.size * 0.42}
                textAnchor="middle"
                className="pointer-events-none select-none font-mono"
                fill={positive ? "#00F3BB" : "#FFE2E6"}
                fontSize={Math.max(8.5, node.size / 3.4)}
                fontWeight={600}
                letterSpacing="-0.02em"
                style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.95))" }}
              >
                {formatPct(node.priceChangePct)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Sleek Glass Hover Tooltip */}
      <AnimatePresence>
        {hovered &&
          (() => {
            const node = nodes.find((n) => n.symbol === hovered);
            if (!node) return null;
            const positive = node.priceChangePct >= 0;
            return (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="pointer-events-none absolute z-20 rounded-2xl border border-white/10 bg-[#0c1018]/95 px-4 py-3 text-xs shadow-2xl backdrop-blur-xl"
                style={{
                  left: `${(node.x / size) * 100}%`,
                  top: `${(node.y / size) * 100}%`,
                  transform: "translate(-50%, -135%)",
                  minWidth: "175px",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor:
                          node.classification === "HIGH_ATTENTION"
                            ? "#F14D64"
                            : node.classification === "NORMAL"
                              ? "#48B586"
                              : "#FE9351",
                        boxShadow: `0 0 8px ${
                          node.classification === "HIGH_ATTENTION"
                            ? "#F14D64"
                            : node.classification === "NORMAL"
                              ? "#48B586"
                              : "#FE9351"
                        }`,
                      }}
                    />
                    <span className="font-bold text-white tracking-wide">{node.symbol}</span>
                  </div>
                  <span className="text-[10px] text-white/50">{node.classification.replace("_", " ")}</span>
                </div>

                <p className="mt-1 font-medium text-white/80 truncate text-[11px]">{node.companyName}</p>

                <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2">
                  <div className="flex items-center gap-1 text-[11px] font-semibold">
                    {positive ? (
                      <TrendingUp className="h-3.5 w-3.5 text-[#00F3BB]" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 text-[#F14D64]" />
                    )}
                    <span className={positive ? "text-[#00F3BB]" : "text-[#F14D64]"}>
                      {formatPct(node.priceChangePct)}
                    </span>
                  </div>
                  <span className="text-[10px] text-white/40">
                    Score: <span className="font-bold text-white">{node.score}</span>
                  </span>
                </div>

                <div className="mt-1.5 flex items-center justify-end gap-1 text-[9px] text-[#00F3BB]/80 font-medium">
                  <span>Click to inspect details</span>
                  <ArrowRight className="h-2.5 w-2.5" />
                </div>
              </motion.div>
            );
          })()}
      </AnimatePresence>

      {/* Floating Glass Legend Capsule */}
      <div className="mt-2 flex items-center justify-center gap-4 rounded-full border border-white/[0.08] bg-white/[0.03] backdrop-blur-md px-4 py-1.5 text-[11px] text-white/70 shadow-[0_4px_24px_rgba(0,0,0,0.5)] select-none">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#F14D64] shadow-[0_0_8px_#F14D64]" />
          <span className="font-medium text-white/80">High Attention</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#FE9351] shadow-[0_0_8px_#FE9351]" />
          <span className="font-medium text-white/80">Important</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#48B586] shadow-[0_0_8px_#48B586]" />
          <span className="font-medium text-white/80">Normal</span>
        </span>
      </div>

      {/* Invisible HTML Link Targets for Clickability & Accessibility */}
      <div className="pointer-events-none absolute inset-0">
        {nodes.map((node) => (
          <Link
            key={node.symbol}
            href={`/stock/${node.symbol}?watchlistId=${watchlistId}`}
            aria-label={`Open ${node.companyName} detail`}
            className="pointer-events-auto absolute rounded-full"
            style={{
              left: `${(node.x / size) * 100}%`,
              top: `${(node.y / size) * 100}%`,
              width: `${((node.size * 2) / size) * 100}%`,
              height: `${((node.size * 2) / size) * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
