"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { api } from "@/lib/api-client";
import { usePulseStore } from "@/lib/store";
import { Card, EmptyState, Skeleton } from "@/components/ui/primitives";

export default function WatchlistListPage() {
  const [watchlists, setWatchlists] = useState<any[] | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const { setActiveWatchlistId } = usePulseStore();

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const { watchlists } = await api.listWatchlists();
    setWatchlists(watchlists);
  }

  async function create() {
    if (!name.trim()) return;

    setCreating(true);

    try {
      const { watchlist } = await api.createWatchlist(name.trim());

      setName("");
      await load();
      setActiveWatchlistId(watchlist.id);
    } finally {
      setCreating(false);
    }
  }

  if (!watchlists) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-white">
        Your Watchlists
      </h1>

      <p className="mt-1 text-sm text-white/40">
        Organize what PULSE monitors for you.
      </p>

      <div className="mt-6 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="e.g. Long Term, AI, Indian Stocks"
          className="glass w-full max-w-sm rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-signal-500/50"
        />

        <button
          onClick={create}
          disabled={creating || !name.trim()}
          className="flex items-center gap-1.5 rounded-xl bg-pulse-gradient px-4 py-2.5 text-sm font-semibold text-ink-950 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Create
        </button>
      </div>

      {watchlists.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No watchlists yet"
            description="Create your first one above to start tracking signals."
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {watchlists.map((w, i) => (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                href={`/watchlist/${w.id}`}
                onClick={() => setActiveWatchlistId(w.id)}
              >
                <Card hover>
                  <p className="font-display text-base font-semibold text-white">
                    {w.name}
                  </p>

                  <p className="mt-1 text-xs text-white/40">
                    {w.stocks?.length ?? 0} symbols
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(w.stocks ?? []).slice(0, 5).map((s: any) => (
                      <span
                        key={s.symbol}
                        className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white/50"
                      >
                        {s.symbol}
                      </span>
                    ))}
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}