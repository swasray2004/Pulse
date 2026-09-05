"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api-client";
import { formatPct, formatPrice, stateLabel } from "@/lib/format";
import { Card, ClassificationBadge, StateBadge, Skeleton } from "@/components/ui/primitives";
import { NumberMorph } from "@/components/NumberMorph";

function conclusionFor(state: string, symbol: string): string {
  switch (state) {
    case "EVENT_DRIVEN":
      return `This appears to be a company-specific movement. ${symbol} significantly outperformed both the broader market and its sector while trading volume increased substantially — a likely contributor is the event detected below.`;
    case "MARKET_MOVING":
      return `${symbol} is moving roughly in line with the broader market. This looks like a market-wide movement rather than something specific to the company.`;
    case "BREAKOUT":
      return `${symbol} is trading near a 52-week extreme with a meaningful price move — a possible breakout, though PULSE can't confirm intent or durability.`;
    case "UNUSUAL_ACTIVITY":
      return `Volume is unusually high without a matching price move yet. This sometimes precedes a larger move — worth a second look, not a confirmed signal.`;
    case "OUTPERFORMING":
      return `${symbol} is outperforming its benchmark and sector. Possible drivers include company-specific news not yet reflected in the event feed.`;
    case "UNDERPERFORMING":
      return `${symbol} is underperforming its benchmark and sector.`;
    default:
      return `${symbol}'s movement is within its normal range — nothing here rises to the level of a signal.`;
  }
}

export default function StockDetailPage() {
  const params = useParams<{ symbol: string }>();
  const searchParams = useSearchParams();
  const watchlistId = searchParams.get("watchlistId") ?? undefined;
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.getStock(params.symbol, watchlistId).then(setData);
  }, [params.symbol, watchlistId]);

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const positive = data.attention.priceChangePct >= 0;
  const signals = data.attention.signals;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-white/40">{data.symbol}</p>
          <h1 className="font-display text-3xl font-bold text-white">{data.companyName}</h1>
        </div>
        <div className="text-right">
          <p className={`font-display text-3xl font-bold ${positive ? "text-pulse-400" : "text-rose-400"}`}>
            {formatPct(data.attention.priceChangePct)}
          </p>
          <p className="font-mono text-sm text-white/40">
            {formatPrice(data.symbol, data.priceFrom)} → {formatPrice(data.symbol, data.priceTo)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <ClassificationBadge classification={data.attention.classification} />
        <StateBadge state={data.state} />
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-wide text-white/40">Attention Score</p>
          <p className="font-display text-4xl font-bold text-white">
            <NumberMorph value={data.attention.score} />
            <span className="text-lg text-white/30">/100</span>
          </p>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${data.attention.score}%` }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="h-full rounded-full bg-pulse-gradient"
          />
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-white/40">Why This Matters</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-white/80">{conclusionFor(data.state, data.symbol)}</p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SignalStat label="Price" value={formatPct(data.attention.priceChangePct)} />
          <SignalStat label="Volume" value={`${data.attention.volumeRatio.toFixed(1)}x normal`} />
          <SignalStat label="vs Benchmark" value={formatPct(data.attention.relativeToBenchmarkPct)} />
          <SignalStat label="vs Sector" value={formatPct(data.attention.relativeToSectorPct)} />
          <SignalStat label="52w High" value={formatPrice(data.symbol, data.fiftyTwoWeekHigh)} />
          <SignalStat label="52w Low" value={formatPrice(data.symbol, data.fiftyTwoWeekLow)} />
        </div>

        {data.events.length > 0 && (
          <div className="mt-5 border-t border-white/5 pt-4">
            <p className="text-xs uppercase tracking-wide text-white/35">Relevant events</p>
            <ul className="mt-2 space-y-1.5">
              {data.events.map((e: any, i: number) => (
                <li key={i} className="text-sm text-white/70">
                  <span className="font-medium capitalize">{e.type.replace("_", " ")}:</span> {e.headline}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-white/40">Signal Details</h2>
        <p className="mt-1 text-xs text-white/35">
          The raw breakdown feeding the Attention Score — for transparency, not just trust.
        </p>
        <div className="mt-4 space-y-2.5">
          <SignalBar label="Price movement" value={signals.price} max={30} />
          <SignalBar label="Volume anomaly" value={signals.volume} max={20} />
          <SignalBar label="Relative performance" value={signals.relativePerformance} max={20} />
          <SignalBar label="Event corroboration" value={signals.event} max={15} />
          <SignalBar label="Volatility context" value={signals.volatility} max={10} />
          <SignalBar label="Personalization" value={signals.personalization} max={10} min={-10} />
        </div>
      </Card>
    </motion.div>
  );
}

function SignalStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.02] p-3">
      <p className="text-[10px] uppercase tracking-wide text-white/35">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function SignalBar({ label, value, max, min = 0 }: { label: string; value: number; max: number; min?: number }) {
  const range = max - min;
  const pct = Math.min(100, Math.max(0, ((value - min) / range) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-white/50">{label}</span>
        <span className="font-mono text-white/70">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full bg-pulse-gradient"
        />
      </div>
    </div>
  );
}
