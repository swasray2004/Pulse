"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Card, ClassificationBadge, StateBadge } from "./ui/primitives";
import { NumberMorph } from "./NumberMorph";
import { formatPct } from "@/lib/format";

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

export function AttentionCard({ data, index, watchlistId }: { data: AttentionCardData; index: number; watchlistId: string }) {
  const positive = data.attention.priceChangePct >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link href={`/stock/${data.symbol}?watchlistId=${watchlistId}`}>
        <Card hover className="group relative overflow-hidden">
          <div
            className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl transition-opacity duration-500 group-hover:opacity-70 ${
              positive ? "bg-pulse-500/20" : "bg-rose-500/20"
            } opacity-40`}
          />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="font-display text-[15px] font-semibold text-white">{data.companyName}</p>
              <p className="font-mono text-[11px] uppercase tracking-wider text-white/40">{data.symbol}</p>
            </div>
            <div className="text-right">
              <p className={`font-display text-lg font-semibold ${positive ? "text-pulse-400" : "text-rose-400"}`}>
                {formatPct(data.attention.priceChangePct)}
              </p>
              <p className="font-mono text-[11px] text-white/40">{data.attention.volumeRatio.toFixed(1)}x volume</p>
            </div>
          </div>

          <div className="relative mt-4 flex items-center gap-2">
            <ClassificationBadge classification={data.attention.classification} />
            <StateBadge state={data.state} />
          </div>

          <div className="relative mt-4 flex items-end justify-between">
            <p className="max-w-[75%] text-[13px] leading-relaxed text-white/60">{data.attention.reason}</p>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/30">Attention</p>
              <p className="font-display text-2xl font-bold text-white">
                <NumberMorph value={data.attention.score} />
                <span className="text-sm font-medium text-white/30">/100</span>
              </p>
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}
