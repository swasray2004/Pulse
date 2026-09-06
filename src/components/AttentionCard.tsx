"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { formatPct } from "@/lib/format";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  BarChart3,
  ArrowUpRight,
} from "lucide-react";

export interface AttentionCardData {
  symbol: string;
  companyName: string;
  attention: {
    score: number;
    classification: string;
    reason: string;
    priceChangePct: number;
    relativeToBenchmarkPct: number;
    volumeRatio: number;
  };
  state: string;
}

const CLASS_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; label: string }
> = {
  HIGH_ATTENTION: {
    color: "#F14D64",
    bg: "rgba(241,77,100,0.08)",
    border: "rgba(241,77,100,0.2)",
    label: "High Attention",
  },
  IMPORTANT: {
    color: "#FE9351",
    bg: "rgba(254,147,81,0.08)",
    border: "rgba(254,147,81,0.2)",
    label: "Important",
  },
  INTERESTING: {
    color: "#FE9351",
    bg: "rgba(254,147,81,0.08)",
    border: "rgba(254,147,81,0.2)",
    label: "Interesting",
  },
  NORMAL: {
    color: "#48B586",
    bg: "rgba(72,181,134,0.08)",
    border: "rgba(72,181,134,0.2)",
    label: "Normal",
  },
};

function getIconForCard(
  symbol: string,
  classification: string,
  positive: boolean,
) {
  const cfg = CLASS_CONFIG[classification] ?? CLASS_CONFIG.NORMAL;

  if (classification === "HIGH_ATTENTION") {
    return positive ? (
      <TrendingUp className="h-4 w-4" style={{ color: cfg.color }} />
    ) : (
      <TrendingDown className="h-4 w-4" style={{ color: cfg.color }} />
    );
  }
  if (classification === "IMPORTANT" || classification === "INTERESTING") {
    return <Zap className="h-4 w-4" style={{ color: cfg.color }} />;
  }
  if (symbol === "TSLA" || symbol === "NVDA") {
    return <BarChart3 className="h-4 w-4" style={{ color: cfg.color }} />;
  }
  return <Activity className="h-4 w-4" style={{ color: cfg.color }} />;
}

export function AttentionCard({
  data,
  index,
  watchlistId,
}: {
  data: AttentionCardData;
  index: number;
  watchlistId: string;
}) {
  const positive = data.attention.priceChangePct >= 0;
  const cfg =
    CLASS_CONFIG[data.attention.classification] ?? CLASS_CONFIG.NORMAL;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={`/stock/${data.symbol}?watchlistId=${watchlistId}`}
        className="block group"
      >
        <div className="relative flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 backdrop-blur-xl transition-all duration-300 hover:border-white/[0.14] hover:bg-white/[0.055] hover:translate-y-[-2px] hover:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">

          {/* Top row: icon + pills */}
          <div className="flex items-center justify-between">
            {/* Classification icon bubble */}
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
            >
              {getIconForCard(
                data.symbol,
                data.attention.classification,
                positive,
              )}
            </div>

            {/* Right pills: % change + score */}
            <div className="flex items-center gap-2">
              <span
                className="rounded-lg px-2 py-0.5 font-mono text-[12px] font-bold tabular-nums"
                style={{
                  background: positive
                    ? "rgba(72,181,134,0.1)"
                    : "rgba(241,77,100,0.1)",
                  color: positive ? "#48B586" : "#F14D64",
                  border: `1px solid ${positive ? "rgba(72,181,134,0.25)" : "rgba(241,77,100,0.25)"}`,
                }}
              >
                {formatPct(data.attention.priceChangePct)}
              </span>
              <span className="rounded-lg bg-white/[0.05] border border-white/[0.09] px-2 py-0.5 font-mono text-[11px] font-semibold text-white/60 tabular-nums">
                {data.attention.score}
                <span className="text-white/30 font-normal">/100</span>
              </span>
            </div>
          </div>

          {/* Company info */}
          <div>
            <h3 className="font-display text-[15px] font-bold text-white tracking-tight group-hover:text-[#00F3BB] transition-colors leading-tight line-clamp-1">
              {data.companyName}
            </h3>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="font-mono text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                {data.symbol}
              </span>
              <span className="text-white/15">·</span>
              <span
                className="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                style={{
                  color: cfg.color,
                  background: cfg.bg,
                  border: `1px solid ${cfg.border}`,
                }}
              >
                {data.state.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          {/* Reason */}
          <p className="text-[12px] leading-relaxed text-white/55 line-clamp-2">
            {data.attention.reason}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-white/[0.05] pt-3 text-[11px]">
            <span className="text-white/35">
              Vol{" "}
              <strong className="font-mono text-white/65 font-semibold tabular-nums">
                {data.attention.volumeRatio.toFixed(1)}×
              </strong>{" "}
              normal
            </span>
            <span className="inline-flex items-center gap-0.5 font-semibold text-[#00F3BB] opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
              Inspect <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
