"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { usePulseStore } from "@/lib/store";
import { AwaySummaryStrip } from "@/components/AwaySummaryStrip";
import { AttentionCard } from "@/components/AttentionCard";
import { Card, EmptyState, Skeleton } from "@/components/ui/primitives";

export default function WhileYouWereAwayPage() {
  const { activeWatchlistId, setActiveWatchlistId } = usePulseStore();
  const [pulse, setPulse] = useState<any>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { watchlists } = await api.listWatchlists();
        let targetId = activeWatchlistId;
        if (!watchlists.some((w) => w.id === targetId)) {
          targetId = watchlists.length > 0 ? watchlists[0].id : null;
          setActiveWatchlistId(targetId);
        }
        if (targetId) {
          const data = await api.getPulse(targetId);
          setPulse(data);
        } else {
          setPulse(null);
        }
      } catch (e) {
        console.error("Failed to load away pulse:", e);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [activeWatchlistId, setActiveWatchlistId]);

  async function acknowledge() {
    if (!activeWatchlistId) return;
    await api.checkIn(activeWatchlistId);
    setCheckedIn(true);
  }

  if (loading) return <Skeleton className="h-96 w-full" />;

  if (!activeWatchlistId) {
    return (
      <EmptyState
        title="No active watchlist"
        description="Pick a watchlist first so PULSE knows what to compare."
        action={
          <Link href="/watchlist" className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15">
            Choose a watchlist
          </Link>
        }
      />
    );
  }
  if (!pulse.awaySummary) {
    return <EmptyState title="Your market is quiet" description="No movements to report yet." />;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <AwaySummaryStrip
        awayLabel={pulse.awaySummary.awayLabel}
        totalMovements={pulse.awaySummary.totalMovements}
        meaningfulCount={pulse.awaySummary.meaningfulCount}
        filteredCount={pulse.awaySummary.filteredCount}
        isLongAbsence={pulse.awaySummary.isLongAbsence}
      />

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-white/40">Timeline</h2>
        <Link href="/replay" className="text-xs font-medium text-signal-400 hover:text-signal-300">
          Replay it →
        </Link>
      </div>

      <Card className="mb-8">
        <div className="relative space-y-5 border-l border-white/10 pl-5">
          {(pulse.timeline ?? []).map((t: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="relative"
            >
              <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full bg-signal-500 shadow-glow" />
              <p className="font-mono text-[11px] text-white/35">
                {new Date(t.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-sm text-white/80">{t.label}</p>
            </motion.div>
          ))}
          <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: (pulse.timeline ?? []).length * 0.08 }} className="relative">
            <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full bg-pulse-500 shadow-glow-pulse" />
            <p className="font-mono text-[11px] text-white/35">Now</p>
            <p className="text-sm text-white/80">You returned</p>
          </motion.div>
        </div>
        {pulse.awaySummary.filteredCount > 0 && (
          <p className="mt-4 border-t border-white/5 pt-3 text-xs text-white/30">
            {pulse.awaySummary.filteredCount} other movements filtered
          </p>
        )}
      </Card>

      <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-white/40">
        What deserves your attention
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {pulse.signals.map((s: any, i: number) => (
          <AttentionCard key={s.symbol} data={s} index={i} watchlistId={pulse.watchlist.id} />
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <button
          onClick={acknowledge}
          disabled={checkedIn}
          className="rounded-full bg-pulse-gradient px-6 py-3 text-sm font-semibold text-ink-950 shadow-glow transition-transform hover:scale-105 disabled:opacity-50"
        >
          {checkedIn ? "Caught up ✓" : "I'm caught up — reset the clock"}
        </button>
      </div>
    </div>
  );
}
