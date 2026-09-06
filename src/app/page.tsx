"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { api, PulseResult, PulseSignal } from "@/lib/api-client";
import { usePulseStore } from "@/lib/store";
import { AttentionCard } from "@/components/AttentionCard";
import { MarketMap } from "@/components/MarketMap";
import { SignalNoisePanel } from "@/components/SignalNoisePanel";
import { WatchlistAttentionTimeline } from "@/components/WatchlistAttentionTimeline";
import { Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import { PulseMark } from "@/components/PulseMark";
import { ArrowRight, Activity } from "lucide-react";

const STARTER_SYMBOLS = ["NVDA", "TSLA", "AAPL", "MSFT", "TCS"];

export default function PulseHomePage() {
  const { activeWatchlistId, setActiveWatchlistId } = usePulseStore();
  const [loading, setLoading] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [pulse, setPulse] = useState<PulseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function bootstrap() {
    setLoading(true);
    setError(null);

    try {
      const { watchlists } = await api.listWatchlists();

      let watchlistId = activeWatchlistId;

      // Validate that activeWatchlistId belongs to the currently logged in user
      if (!watchlists || !watchlists.some((w) => w.id === watchlistId)) {
        watchlistId = watchlists && watchlists.length > 0 ? watchlists[0].id : null;
        setActiveWatchlistId(watchlistId);
      }

      if (watchlistId) {
        try {
          const data = await api.getPulse(watchlistId);
          setPulse(data);
        } catch (pulseErr: unknown) {
          // If the selected watchlist wasn't found (e.g. stale ID), fallback to first available
          if (watchlists && watchlists.length > 0 && watchlists[0].id !== watchlistId) {
            watchlistId = watchlists[0].id;
            setActiveWatchlistId(watchlistId);
            const data = await api.getPulse(watchlistId);
            setPulse(data);
          } else {
            throw pulseErr;
          }
        }
      } else {
        setPulse(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function createStarterWatchlist() {
    setBootstrapping(true);
    setError(null);

    try {
      const { watchlist } = await api.createWatchlist("My Watchlist");

      await Promise.all(
        STARTER_SYMBOLS.map((symbol) =>
          api.addStock(watchlist.id, symbol),
        ),
      );

      setActiveWatchlistId(watchlist.id);

      const data = await api.getPulse(watchlist.id);
      setPulse(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not create watchlist");
    } finally {
      setBootstrapping(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-5 w-48 rounded-full" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-14 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Skeleton className="h-[480px] lg:col-span-5 rounded-3xl" />
          <Skeleton className="h-[480px] lg:col-span-7 rounded-3xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Market data is temporarily unavailable"
        description={error}
        action={
          <button
            onClick={bootstrap}
            className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
          >
            Retry
          </button>
        }
      />
    );
  }

  if (!pulse) {
    return (
      <EmptyState
        title="Your watchlist is empty"
        description="Add your first signal. PULSE will start tracking what matters — and tell you what changed, next time you check."
        action={
          <button
            onClick={createStarterWatchlist}
            disabled={bootstrapping}
            className="mt-2 flex items-center gap-2 rounded-xl bg-[#00F3BB] hover:bg-[#33F7C9] px-5 py-2.5 text-sm font-bold text-ink-950 shadow-[0_0_24px_rgba(0,243,187,0.35)] hover:shadow-[0_0_32px_rgba(0,243,187,0.5)] transition-all hover:scale-105 disabled:opacity-60"
          >
            <PulseMark size={18} animated={false} />
            {bootstrapping
              ? "Setting up..."
              : "Create watchlist with starter stocks"}
          </button>
        }
      />
    );
  }

  const { watchlist, awaySummary, signals, noise } = pulse;

  if (!awaySummary) {
    return (
      <EmptyState
        title="Your market is quiet"
        description="No watched symbols yet in this list."
        action={
          <Link
            href={`/watchlist/${watchlist.id}`}
            className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
          >
            Manage watchlist
          </Link>
        }
      />
    );
  }

  const mapEntries = [...signals, ...noise].map((s: PulseSignal) => ({
    symbol: s.symbol,
    companyName: s.companyName,
    score: s.attention.score,
    priceChangePct: s.attention.priceChangePct,
    classification: s.attention.classification,
  }));

  const awayText = awaySummary.awayLabel.toLowerCase().startsWith("since")
    ? awaySummary.awayLabel
    : `Away for ${awaySummary.awayLabel}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-8"
    >
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-8 border-b border-white/[0.07]">
        <div className="space-y-4 max-w-2xl">
          {/* Watchlist badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.09] text-[12px] text-white/60">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00F3BB] opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#00F3BB]" />
            </span>
            <span className="font-medium">{watchlist.name}</span>
            <span className="text-white/20">·</span>
            <span className="text-white/40">Market Intelligence</span>
          </div>

          {/* Primary headline */}
          <h1 className="font-display font-extrabold tracking-tight text-white leading-[1.1]">
            <span className="block text-[40px] sm:text-[52px]">What changed.</span>
            <span className="block text-[40px] sm:text-[52px]">What matters. <span className="text-[#00F3BB]">Why.</span></span>
          </h1>

          <p className="text-[14px] leading-relaxed text-white/50 max-w-xl">
            PULSE monitors your watchlist for volume anomalies, volatility breakouts, and news catalysts — then surfaces only what actually deserves your attention.
          </p>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            href="/away"
            className="inline-flex items-center gap-2 rounded-xl bg-[#5367FE] hover:bg-[#687BFE] px-5 py-2.5 text-[13px] font-semibold text-white transition-all shadow-[0_0_28px_rgba(83,103,254,0.35)] hover:shadow-[0_0_36px_rgba(83,103,254,0.55)] hover:translate-y-[-1px] active:translate-y-0"
          >
            <Activity className="h-4 w-4" />
            Get Started
          </Link>

          <Link
            href={`/watchlist/${watchlist.id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] hover:border-white/[0.18] bg-white/[0.04] hover:bg-white/[0.07] px-4 py-2.5 text-[13px] font-medium text-white/70 hover:text-white transition-all"
          >
            Manage Watchlist
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold font-mono text-white/60">
              {mapEntries.length}
            </span>
          </Link>
        </div>
      </div>

      {/* ── Telemetry Strip ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-5 py-3.5 text-[13px] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00F3BB] opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00F3BB]" />
          </span>
          <span className="text-white/60">
            <span className="font-semibold text-white">{awayText}</span>
            {" · "}
            <span className="text-[#00F3BB] font-semibold">{awaySummary.meaningfulCount} high-signal</span>
            {" movements warrant review"}
          </span>
        </div>

        <div className="flex items-center gap-5 text-white/40 text-[12px]">
          <span>
            Tracked <strong className="font-mono text-white/70 font-semibold tabular-nums">{awaySummary.totalMovements}</strong>
          </span>
          <span>
            Filtered <strong className="font-mono text-white/50 font-semibold tabular-nums">{awaySummary.filteredCount}</strong>
          </span>
          <Link
            href="/away"
            className="inline-flex items-center gap-1 font-semibold text-[#00F3BB] hover:text-[#33F7C9] transition-colors"
          >
            Review timeline <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* ── Dual Panel ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">

        {/* Left: Market Attention Map */}
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-2xl p-6 shadow-[0_8px_40px_rgba(0,0,0,0.4)] flex flex-col lg:col-span-5">
          {/* Panel header */}
          <div className="flex items-start justify-between pb-4 border-b border-white/[0.06] mb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00F3BB] opacity-60" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#00F3BB]" />
                </span>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/70">
                  Attention Map
                </h2>
              </div>
              <p className="text-[12px] text-white/35 mt-1">
                Proximity to core = urgency
              </p>
            </div>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] font-medium text-white/50">
              {mapEntries.length} stocks
            </span>
          </div>

          {/* Map canvas */}
          <div className="flex flex-1 items-center justify-center">
            <MarketMap entries={mapEntries} watchlistId={watchlist.id} />
          </div>
        </div>

        {/* Right: Attention Queue */}
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-2xl p-6 shadow-[0_8px_40px_rgba(0,0,0,0.4)] space-y-5 lg:col-span-7">
          {/* Panel header */}
          <div className="flex items-start justify-between pb-4 border-b border-white/[0.06]">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/70">
                  Attention Queue
                </h2>
                {signals.length > 0 && (
                  <span className="rounded-full bg-[#F14D64]/15 border border-[#F14D64]/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#F14D64]">
                    {signals.length} signals
                  </span>
                )}
              </div>
              <p className="text-[12px] text-white/35 mt-1">
                Ranked by catalyst significance &amp; volume anomaly
              </p>
            </div>
            <Link
              href={`/watchlist/${watchlist.id}`}
              className="text-[12px] font-medium text-white/30 hover:text-white/70 transition-colors shrink-0"
            >
              Configure →
            </Link>
          </div>

          {/* Cards */}
          <div>
            {signals.length === 0 ? (
              <Card>
                <p className="text-sm text-white/50">
                  Nothing needs your attention right now — all stocks are tracking within normal volatility bands.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {signals.map((signal: PulseSignal, index: number) => (
                  <AttentionCard
                    key={signal.symbol}
                    data={signal}
                    index={index}
                    watchlistId={watchlist.id}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Noise panel */}
          <SignalNoisePanel noise={noise} />
        </div>
      </div>

      {/* ── Watchlist Attention Timeline ────────────────────────────────── */}
      <WatchlistAttentionTimeline
        watchlistId={watchlist.id}
        fallbackScore={
          signals.length > 0
            ? Math.round(
                signals.reduce(
                  (sum: number, s: PulseSignal) => sum + (s.attention?.score ?? 0),
                  0,
                ) / signals.length,
              )
            : 15
        }
      />
    </motion.div>
  );
}
