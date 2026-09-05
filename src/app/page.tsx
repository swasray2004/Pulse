"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { usePulseStore } from "@/lib/store";
import { AwaySummaryStrip } from "@/components/AwaySummaryStrip";
import { AttentionCard } from "@/components/AttentionCard";
import { MarketMap } from "@/components/MarketMap";
import { SignalNoisePanel } from "@/components/SignalNoisePanel";
import { Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import { PulseMark } from "@/components/PulseMark";

const STARTER_SYMBOLS = ["NVDA", "TSLA", "AAPL", "MSFT", "TCS"];

export default function PulseHomePage() {
  const { activeWatchlistId, setActiveWatchlistId } = usePulseStore();
  const [loading, setLoading] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [pulse, setPulse] = useState<any>(null);
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
      if (!watchlists.some((w) => w.id === watchlistId)) {
        watchlistId = watchlists.length > 0 ? watchlists[0].id : null;
        setActiveWatchlistId(watchlistId);
      }

      if (watchlistId) {
        const data = await api.getPulse(watchlistId);
        setPulse(data);
      } else {
        setPulse(null);
      }
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
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
    } catch (e: any) {
      setError(e.message ?? "Could not create watchlist");
    } finally {
      setBootstrapping(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />

        <div className="grid grid-cols-3 gap-3 sm:max-w-xl">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>

        <Skeleton className="h-64 w-full" />
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
            className="mt-2 flex items-center gap-2 rounded-full bg-pulse-gradient px-5 py-2.5 text-sm font-semibold text-ink-950 shadow-glow transition-transform hover:scale-105 disabled:opacity-60"
          >
            <PulseMark size={16} animated={false} />
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

  const mapEntries = [...signals, ...noise].map((s: any) => ({
    symbol: s.symbol,
    companyName: s.companyName,
    score: s.attention.score,
    priceChangePct: s.attention.priceChangePct,
    classification: s.attention.classification,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <AwaySummaryStrip
        awayLabel={awaySummary.awayLabel}
        totalMovements={awaySummary.totalMovements}
        meaningfulCount={awaySummary.meaningfulCount}
        filteredCount={awaySummary.filteredCount}
        isLongAbsence={awaySummary.isLongAbsence}
      />

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-white/40">
          Market Map
        </h2>

        <Link
          href="/away"
          className="text-xs font-medium text-signal-400 hover:text-signal-300"
        >
          See what changed ?
        </Link>
      </div>

      <MarketMap
        entries={mapEntries}
        watchlistId={watchlist.id}
      />

      <div className="mb-3 mt-8 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-white/40">
          Attention Queue
        </h2>

        <Link
          href={`/watchlist/${watchlist.id}`}
          className="text-xs font-medium text-white/40 hover:text-white/70"
        >
          Manage watchlist
        </Link>
      </div>

      {signals.length === 0 ? (
        <Card>
          <p className="text-sm text-white/50">
            Nothing needs your attention right now — everything is tracking
            normally.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {signals.map((signal: any, index: number) => (
            <AttentionCard
              key={signal.symbol}
              data={signal}
              index={index}
              watchlistId={watchlist.id}
            />
          ))}
        </div>
      )}

      <SignalNoisePanel noise={noise} />
    </motion.div>
  );
}
