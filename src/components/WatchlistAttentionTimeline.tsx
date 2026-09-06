"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { api } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/primitives";

export type AttentionTimeframe = "1D" | "1W" | "1M" | "3M";

interface AttentionPoint {
  timestamp: string;
  date: string;
  score: number;
  stockCount: number;
}

const TIMEFRAME_DAYS: Record<AttentionTimeframe, number> = {
  "1D": 1,
  "1W": 7,
  "1M": 30,
  "3M": 90,
};

const TIMEFRAME_OPTIONS: AttentionTimeframe[] = ["1D", "1W", "1M", "3M"];

function formatAxisTime(isoString: string, points: AttentionPoint[]): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";

  const span =
    points.length >= 2
      ? new Date(points[points.length - 1].timestamp).getTime() -
        new Date(points[0].timestamp).getTime()
      : 0;

  const spanDays = span / (1000 * 60 * 60 * 24);

  if (spanDays <= 1) {
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTooltipTime(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function filterToTimeframe(
  points: AttentionPoint[],
  timeframe: AttentionTimeframe,
): AttentionPoint[] {
  if (points.length < 2) return points;

  const cutoff = new Date(
    Date.now() - TIMEFRAME_DAYS[timeframe] * 24 * 60 * 60 * 1000,
  );

  const filtered = points.filter(
    (p) => new Date(p.timestamp).getTime() >= cutoff.getTime(),
  );

  return filtered.length >= 1 ? filtered : points;
}

function scoreLevel(score: number): {
  label: string;
  color: string;
  badgeBg: string;
  badgeBorder: string;
} {
  if (score >= 65) {
    return {
      label: "HIGH ATTENTION",
      color: "#FF6B81",
      badgeBg: "rgba(255,107,129,0.12)",
      badgeBorder: "rgba(255,107,129,0.25)",
    };
  }
  if (score >= 40) {
    return {
      label: "ELEVATED",
      color: "#00F3BB",
      badgeBg: "rgba(0,243,187,0.12)",
      badgeBorder: "rgba(0,243,187,0.25)",
    };
  }
  if (score >= 20) {
    return {
      label: "INTERESTING",
      color: "#5367FE",
      badgeBg: "rgba(83,103,254,0.15)",
      badgeBorder: "rgba(83,103,254,0.28)",
    };
  }
  return {
    label: "QUIET",
    color: "rgba(255,255,255,0.4)",
    badgeBg: "rgba(255,255,255,0.05)",
    badgeBorder: "rgba(255,255,255,0.1)",
  };
}

function AttentionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: AttentionPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  const level = scoreLevel(point.score);

  return (
    <div className="rounded-xl border border-white/[0.12] bg-[#0B0F19]/95 backdrop-blur-xl px-3.5 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] text-xs min-w-[150px]">
      <p className="font-mono text-[11px] text-white/40">
        {formatTooltipTime(point.timestamp)}
      </p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: level.color }}
          />
          <span className="font-medium text-white/70">Attention:</span>
        </div>
        <span className="font-mono font-bold text-white text-[13px]">
          {point.score}
        </span>
      </div>
      <div className="mt-1.5 pt-1.5 border-t border-white/[0.08] flex items-center justify-between text-[10px]">
        <span className="text-white/40">{point.stockCount} stocks tracked</span>
        <span style={{ color: level.color }} className="font-semibold uppercase">
          {level.label}
        </span>
      </div>
    </div>
  );
}

interface WatchlistAttentionTimelineProps {
  watchlistId: string;
  fallbackScore?: number;
}

export function WatchlistAttentionTimeline({
  watchlistId,
  fallbackScore,
}: WatchlistAttentionTimelineProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    ticks: AttentionPoint[];
    currentScore: number;
  }>({ ticks: [], currentScore: fallbackScore ?? 0 });
  const [activeFrame, setActiveFrame] = useState<AttentionTimeframe>("1D");

  useEffect(() => {
    let mounted = true;

    async function loadHistory() {
      setLoading(true);
      try {
        const res = await api.getAttentionHistory(watchlistId);
        if (mounted) {
          setData({
            ticks: res.ticks ?? [],
            currentScore: res.currentScore ?? fallbackScore ?? 0,
          });
        }
      } catch (err) {
        console.error("Failed to load attention history:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (watchlistId) {
      void loadHistory();
    }

    return () => {
      mounted = false;
    };
  }, [watchlistId, fallbackScore]);

  const displayedPoints = useMemo(() => {
    return filterToTimeframe(data.ticks, activeFrame);
  }, [data.ticks, activeFrame]);

  const effectiveScore = useMemo(() => {
    if (displayedPoints.length > 0) {
      return displayedPoints[displayedPoints.length - 1].score;
    }
    return data.currentScore || fallbackScore || 0;
  }, [displayedPoints, data.currentScore, fallbackScore]);

  const level = scoreLevel(effectiveScore);

  const hasData = displayedPoints.length >= 2;
  const gradientId = `attention-timeline-gradient-${watchlistId}`;

  // Palette: vibrant teal with subtle celestial cyan/violet tone
  const lineColor = "#00F3BB";
  const gradientStart = "rgba(0, 243, 187, 0.22)";

  return (
    <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-2xl p-6 sm:p-7 shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
      {/* ── Top Header Row ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00F3BB] opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00F3BB]" />
            </span>
            <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/80">
              Watchlist Attention
            </h2>
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: level.badgeBg,
                color: level.color,
                border: `1px solid ${level.badgeBorder}`,
              }}
            >
              {level.label}
            </span>
          </div>
          <p className="text-[13px] text-white/40 mt-1">
            How much changed over time
          </p>
        </div>

        {/* Right side: Attention Score Badge & Controls */}
        <div className="flex items-center gap-4 sm:gap-6 self-start sm:self-auto">
          {/* Timeframe selector */}
          <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] p-1 border border-white/[0.06]">
            {TIMEFRAME_OPTIONS.map((tf) => {
              const count = filterToTimeframe(data.ticks, tf).length;
              const isAvailable = count >= 2 || data.ticks.length >= 2;

              return (
                <button
                  key={tf}
                  disabled={!isAvailable && !loading}
                  onClick={() => setActiveFrame(tf)}
                  className={[
                    "rounded-lg px-2.5 py-1 text-[11px] font-bold font-mono transition-all",
                    activeFrame === tf
                      ? "bg-[#5367FE] text-white shadow-[0_0_12px_rgba(83,103,254,0.45)]"
                      : isAvailable
                      ? "text-white/40 hover:text-white/80"
                      : "text-white/15 cursor-not-allowed",
                  ].join(" ")}
                >
                  {tf}
                </button>
              );
            })}
          </div>

          {/* Aggregate Attention Score Pill */}
          <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.035] border border-white/[0.08] px-4 py-2">
            <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
              Score
            </span>
            <span
              className="font-mono text-2xl font-extrabold tracking-tight leading-none"
              style={{ color: level.color }}
            >
              {effectiveScore}
            </span>
          </div>
        </div>
      </div>

      {/* ── Chart Display Area ─────────────────────────────────────────── */}
      <div className="pt-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-44 w-full rounded-2xl" />
          </div>
        ) : hasData ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeFrame}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="h-56 w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={displayedPoints}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={gradientStart} />
                      <stop offset="90%" stopColor="rgba(0, 243, 187, 0.0)" />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    stroke="rgba(255,255,255,0.04)"
                    strokeDasharray="3 3"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(val) => formatAxisTime(val, displayedPoints)}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                    tick={{
                      fill: "rgba(255,255,255,0.35)",
                      fontSize: 10,
                      fontFamily: "monospace",
                    }}
                    minTickGap={24}
                  />

                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fill: "rgba(255,255,255,0.25)",
                      fontSize: 10,
                      fontFamily: "monospace",
                    }}
                  />

                  <Tooltip
                    content={<AttentionTooltip />}
                    cursor={{
                      stroke: "rgba(255,255,255,0.15)",
                      strokeWidth: 1,
                      strokeDasharray: "3 3",
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke={lineColor}
                    strokeWidth={2.5}
                    fill={`url(#${gradientId})`}
                    dot={false}
                    activeDot={{
                      r: 4.5,
                      fill: "#00F3BB",
                      stroke: "#0B0F19",
                      strokeWidth: 2,
                    }}
                    isAnimationActive={true}
                    animationDuration={600}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.08] mb-3">
              <span className="h-2 w-2 rounded-full bg-[#00F3BB]/60" />
            </div>
            <p className="text-[13px] font-medium text-white/70">
              Gathering snapshot timeline
            </p>
            <p className="text-[12px] text-white/35 max-w-sm mt-1">
              As continuous market observations accumulate, PULSE plots how attention spikes across your watched assets.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
