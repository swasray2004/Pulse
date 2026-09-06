"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw } from "lucide-react";
import { api } from "@/lib/api-client";
import { usePulseStore } from "@/lib/store";
import { Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import { NumberMorph } from "@/components/NumberMorph";
import { formatPrice } from "@/lib/format";
import Link from "next/link";

interface Tick {
  time: string;
  symbol: string;
  price: number;
  label?: string;
  kind: "price" | "event";
}

export default function ReplayPage() {
  const { activeWatchlistId, setActiveWatchlistId } = usePulseStore();
  const [replay, setReplay] = useState<{ start: string; end: string; ticks: Tick[] } | null>(null);
  const [cursor, setCursor] = useState(0); // index into ticks
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
          const data = await api.getReplay(targetId);
          setReplay(data);
        } else {
          setReplay(null);
        }
      } catch (e) {
        console.error("Failed to load replay:", e);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [activeWatchlistId, setActiveWatchlistId]);

  useEffect(() => {
    if (playing && replay) {
      timerRef.current = setInterval(() => {
        setCursor((c) => {
          if (c >= replay.ticks.length - 1) {
            setPlaying(false);
            return c;
          }
          return c + 1;
        });
      }, 700);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, replay]);

  const currentPrices = useMemo(() => {
    if (!replay) return {} as Record<string, number>;
    const prices: Record<string, number> = {};
    for (let i = 0; i <= cursor; i++) {
      const tick = replay.ticks[i];
      if (tick?.kind === "price") prices[tick.symbol] = tick.price;
    }
    return prices;
  }, [replay, cursor]);

  const eventsSoFar = useMemo(() => {
    if (!replay) return [] as Tick[];
    return replay.ticks.slice(0, cursor + 1).filter((t) => t.kind === "event");
  }, [replay, cursor]);

  if (loading) return <Skeleton className="h-96 w-full" />;

  if (!activeWatchlistId) {
    return (
      <EmptyState
        title="No active watchlist"
        description="Pick a watchlist to replay its away-window."
        action={
          <Link href="/watchlist" className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15">
            Choose a watchlist
          </Link>
        }
      />
    );
  }

  if (!replay) return <Skeleton className="h-96 w-full" />;

  if (replay.ticks.length === 0) {
    return <EmptyState title="Nothing to replay" description="No signals were detected during your last absence." />;
  }

  const progress = ((cursor + 1) / replay.ticks.length) * 100;
  const currentTime = replay.ticks[cursor]?.time ?? replay.start;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Replay</h1>
          <p className="mt-1 font-mono text-xs text-white/40">
            {new Date(currentTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setCursor(0);
              setPlaying(false);
            }}
            className="rounded-full border border-white/10 p-2.5 text-white/60 hover:bg-white/5"
            aria-label="Restart"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setPlaying((p) => !p)}
            className="flex items-center gap-2 rounded-xl bg-[#00F3BB] hover:bg-[#33F7C9] px-5 py-2.5 text-sm font-bold text-ink-950 transition-all shadow-[0_0_20px_rgba(0,243,187,0.35)]"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? "Pause" : "Play"}
          </button>
        </div>
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
          className="h-full rounded-full bg-pulse-gradient"
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Object.entries(currentPrices).map(([symbol, price]) => (
          <Card key={symbol} className="!p-4">
            <p className="font-mono text-xs text-white/40">{symbol}</p>
            <p className="mt-1 font-display text-xl font-bold text-white">
              <NumberMorph value={price} decimals={2} prefix={formatPrice(symbol, 0).replace(/[\d.]/g, "")} />
            </p>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 mt-8 font-display text-sm font-semibold uppercase tracking-wide text-white/40">
        Events so far
      </h2>
      <div className="space-y-2">
        <AnimatePresence>
          {eventsSoFar.map((e, i) => (
            <motion.div
              key={`${e.symbol}-${e.time}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass rounded-xl px-4 py-3 text-sm"
            >
              <span className="font-mono text-xs text-white/35">
                {new Date(e.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="ml-3 text-white/80">{e.label}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {eventsSoFar.length === 0 && <p className="text-sm text-white/30">No events yet — press play.</p>}
      </div>
    </div>
  );
}
