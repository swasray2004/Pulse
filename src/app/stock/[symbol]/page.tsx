"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
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
import { formatPct, formatPrice, stateLabel } from "@/lib/format";
import {
  Card,
  ClassificationBadge,
  StateBadge,
  Skeleton,
} from "@/components/ui/primitives";
import { NumberMorph } from "@/components/NumberMorph";

// ── Local types ───────────────────────────────────────────────────────────────

interface HistoryPoint {
  timestamp: string;
  price: number;
  volume: number;
}

// ── Timeframe configuration ───────────────────────────────────────────────────

type Timeframe = "1D" | "1W" | "1M" | "3M";

const TIMEFRAME_DAYS: Record<Timeframe, number> = {
  "1D": 1,
  "1W": 7,
  "1M": 30,
  "3M": 90,
};

const TIMEFRAME_OPTIONS: Timeframe[] = ["1D", "1W", "1M", "3M"];

// ── Helpers ───────────────────────────────────────────────────────────────────

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

/** Format a timestamp string for chart axis labels */
function formatAxisTime(isoString: string, points: HistoryPoint[]): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";

  const span =
    points.length >= 2
      ? new Date(points[points.length - 1].timestamp).getTime() -
        new Date(points[0].timestamp).getTime()
      : 0;

  const spanDays = span / (1000 * 60 * 60 * 24);

  if (spanDays <= 1) {
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  if (spanDays <= 14) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Format a timestamp for the tooltip */
function formatTooltipTime(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Filter history points to a timeframe window, returning all available if window has < 2 */
function filterToTimeframe(
  history: HistoryPoint[],
  timeframe: Timeframe,
): HistoryPoint[] {
  if (history.length < 2) return history;

  const cutoff = new Date(
    Date.now() - TIMEFRAME_DAYS[timeframe] * 24 * 60 * 60 * 1000,
  );

  const filtered = history.filter(
    (p) => new Date(p.timestamp).getTime() >= cutoff.getTime(),
  );

  return filtered.length >= 1 ? filtered : [];
}

/** Find the largest timeframe that has at least 2 data points */
function defaultTimeframe(history: HistoryPoint[]): Timeframe {
  if (history.length < 2) return "3M";

  const orderedFrames: Timeframe[] = ["1M", "3M", "1W", "1D"];
  for (const tf of orderedFrames) {
    if (filterToTimeframe(history, tf).length >= 2) return tf;
  }
  return "3M";
}

// ── Custom Recharts tooltip ───────────────────────────────────────────────────

function PriceTooltip({
  active,
  payload,
  symbol,
}: {
  active?: boolean;
  payload?: Array<{ payload: HistoryPoint }>;
  symbol: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-glow">
      <p className="font-mono text-white/40">{formatTooltipTime(point.timestamp)}</p>
      <p className="mt-0.5 font-mono font-semibold text-white">
        {formatPrice(symbol, point.price)}
      </p>
    </div>
  );
}

// ── Historical Price Chart ────────────────────────────────────────────────────

function HistoricalChart({
  history,
  symbol,
}: {
  history: HistoryPoint[];
  symbol: string;
}) {
  const [activeFrame, setActiveFrame] = useState<Timeframe>(() =>
    defaultTimeframe(history),
  );

  const displayed = useMemo(
    () => filterToTimeframe(history, activeFrame),
    [history, activeFrame],
  );

  const isPositive = useMemo(() => {
    if (displayed.length < 2) return true;
    return displayed[displayed.length - 1].price >= displayed[0].price;
  }, [displayed]);

  // Pulse design tokens: teal for positive, rose for negative
  const lineColor = isPositive ? "#00F3BB" : "#FF6B81";
  const gradientStart = isPositive
    ? "rgba(0,243,187,0.22)"
    : "rgba(255,107,129,0.22)";

  // Y-axis domain with a little breathing room
  const priceRange = useMemo(() => {
    if (displayed.length === 0) return { min: 0, max: 1 };
    const prices = displayed.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.08 || max * 0.02;
    return { min: min - padding, max: max + padding };
  }, [displayed]);

  const hasData = displayed.length >= 2;
  const gradientId = `chart-gradient-${symbol}`;

  return (
    <Card className="mt-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-wide text-white/40">
          Price History
        </p>

        {/* Timeframe controls */}
        <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] p-0.5">
          {TIMEFRAME_OPTIONS.map((tf) => {
            const count = filterToTimeframe(history, tf).length;
            const available = count >= 2;
            return (
              <button
                key={tf}
                disabled={!available}
                onClick={() => setActiveFrame(tf)}
                className={[
                  "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all",
                  activeFrame === tf
                    ? "bg-white/10 text-white"
                    : available
                    ? "text-white/40 hover:text-white/70"
                    : "cursor-not-allowed text-white/15",
                ].join(" ")}
              >
                {tf}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart area */}
      <AnimatePresence mode="wait">
        {hasData ? (
          <motion.div
            key={activeFrame}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 h-52"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={displayed}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={gradientStart} />
                    <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  vertical={false}
                  stroke="rgba(255,255,255,0.04)"
                  strokeDasharray="0"
                />

                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(v) => formatAxisTime(v, displayed)}
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={48}
                />

                <YAxis
                  domain={[priceRange.min, priceRange.max]}
                  tickFormatter={(v) => `${v.toFixed(0)}`}
                  tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                  tickCount={4}
                />

                <Tooltip
                  content={<PriceTooltip symbol={symbol} />}
                  cursor={{ stroke: "rgba(255,255,255,0.12)", strokeWidth: 1 }}
                />

                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={lineColor}
                  strokeWidth={1.5}
                  fill={`url(#${gradientId})`}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: lineColor,
                    stroke: "rgba(14,17,28,0.9)",
                    strokeWidth: 2,
                  }}
                  isAnimationActive={true}
                  animationDuration={600}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        ) : (
          <motion.div
            key={`empty-${activeFrame}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-4 flex h-52 items-center justify-center"
          >
            <p className="text-center text-xs text-white/30">
              Not enough observations for this window
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Point count footnote */}
      {displayed.length > 0 && (
        <p className="mt-2 text-right text-[10px] text-white/20">
          {displayed.length} observation{displayed.length !== 1 ? "s" : ""}
        </p>
      )}
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

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
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const positive = data.attention.priceChangePct >= 0;
  const signals = data.attention.signals;

  // Validate and normalize history — never crash on bad data
  const history: HistoryPoint[] = Array.isArray(data.history)
    ? (data.history as unknown[]).filter(
        (p): p is HistoryPoint =>
          typeof p === "object" &&
          p !== null &&
          typeof (p as HistoryPoint).timestamp === "string" &&
          typeof (p as HistoryPoint).price === "number" &&
          Number.isFinite((p as HistoryPoint).price),
      )
    : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto max-w-3xl"
    >
      {/* ── Stock header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-white/40">
            {data.symbol}
          </p>
          <h1 className="font-display text-3xl font-bold text-white">
            {data.companyName}
          </h1>
        </div>
        <div className="text-right">
          <p
            className={`font-display text-3xl font-bold ${
              positive ? "text-pulse-400" : "text-rose-400"
            }`}
          >
            {formatPct(data.attention.priceChangePct)}
          </p>
          <p className="font-mono text-sm text-white/40">
            {formatPrice(data.symbol, data.priceFrom)} →{" "}
            {formatPrice(data.symbol, data.priceTo)}
          </p>
        </div>
      </div>

      {/* ── Classification / State badges ─────────────────────────────────── */}
      <div className="mt-4 flex items-center gap-2">
        <ClassificationBadge classification={data.attention.classification} />
        <StateBadge state={data.state} />
      </div>

      {/* ── Historical Price Chart ─────────────────────────────────────────── */}
      <HistoricalChart history={history} symbol={data.symbol} />

      {/* ── Attention Score ────────────────────────────────────────────────── */}
      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-wide text-white/40">
            Attention Score
          </p>
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

      {/* ── Why This Matters ──────────────────────────────────────────────── */}
      <Card className="mt-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-white/40">
          Why This Matters
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-white/80">
          {conclusionFor(data.state, data.symbol)}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SignalStat label="Price" value={formatPct(data.attention.priceChangePct)} />
          <SignalStat
            label="Volume"
            value={`${data.attention.volumeRatio.toFixed(1)}x normal`}
          />
          <SignalStat
            label="vs Benchmark"
            value={formatPct(data.attention.relativeToBenchmarkPct)}
          />
          <SignalStat
            label="vs Sector"
            value={formatPct(data.attention.relativeToSectorPct)}
          />
          <SignalStat
            label="52w High"
            value={formatPrice(data.symbol, data.fiftyTwoWeekHigh)}
          />
          <SignalStat
            label="52w Low"
            value={formatPrice(data.symbol, data.fiftyTwoWeekLow)}
          />
        </div>

        {data.events.length > 0 && (
          <div className="mt-5 border-t border-white/5 pt-4">
            <p className="text-xs uppercase tracking-wide text-white/35">
              Relevant events
            </p>
            <ul className="mt-2 space-y-1.5">
              {data.events.map((e: { type: string; headline: string }, i: number) => (
                <li key={i} className="text-sm text-white/70">
                  <span className="font-medium capitalize">
                    {e.type.replace("_", " ")}:
                  </span>{" "}
                  {e.headline}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* ── Signal Details ────────────────────────────────────────────────── */}
      <Card className="mt-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-white/40">
          Signal Details
        </h2>
        <p className="mt-1 text-xs text-white/35">
          The raw breakdown feeding the Attention Score — for transparency, not just trust.
        </p>
        <div className="mt-4 space-y-2.5">
          <SignalBar label="Price movement" value={signals.price} max={30} />
          <SignalBar label="Volume anomaly" value={signals.volume} max={20} />
          <SignalBar
            label="Relative performance"
            value={signals.relativePerformance}
            max={20}
          />
          <SignalBar
            label="Event corroboration"
            value={signals.event}
            max={15}
          />
          <SignalBar
            label="Volatility context"
            value={signals.volatility}
            max={10}
          />
          <SignalBar
            label="Personalization"
            value={signals.personalization}
            max={10}
            min={-10}
          />
        </div>
      </Card>
    </motion.div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SignalStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.02] p-3">
      <p className="text-[10px] uppercase tracking-wide text-white/35">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function SignalBar({
  label,
  value,
  max,
  min = 0,
}: {
  label: string;
  value: number;
  max: number;
  min?: number;
}) {
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
