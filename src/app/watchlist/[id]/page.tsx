"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Card, Skeleton } from "@/components/ui/primitives";
import { usePulseStore } from "@/lib/store";

interface StockItem {
  symbol: string;
  companyName: string;
}

interface WatchlistDetail {
  id: string;
  name: string;
  stocks: StockItem[];
}

export default function WatchlistDetailPage() {
  const params = useParams<{ id: string }>();
  const watchlistId = params.id;
  const { setActiveWatchlistId } = usePulseStore();

  const [watchlist, setWatchlist] = useState<WatchlistDetail | null>(null);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [results, setResults] = useState<StockItem[]>([]);
  const [adding, setAdding] = useState<string | null>(null);

  const load = async () => {
    const { watchlists } = await api.listWatchlists();
    const found = (watchlists as WatchlistDetail[]).find((w) => w.id === watchlistId) ?? null;
    setWatchlist(found);
  };

  useEffect(() => {
    setActiveWatchlistId(watchlistId);
    let active = true;
    api.listWatchlists().then(({ watchlists }) => {
      if (active) {
        const found = (watchlists as WatchlistDetail[]).find((w) => w.id === watchlistId) ?? null;
        setWatchlist(found);
      }
    });
    return () => {
      active = false;
    };
  }, [watchlistId, setActiveWatchlistId]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      return;
    }
    let active = true;
    api.searchStocks(debouncedQuery).then((r) => {
      if (active) setResults(r.results);
    });
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  async function addStock(symbol: string) {
    setAdding(symbol);
    try {
      await api.addStock(watchlistId, symbol);
      setQuery("");
      setResults([]);
      await load();
    } finally {
      setAdding(null);
    }
  }

  async function removeStock(symbol: string) {
    // optimistic update
    setWatchlist((w) => (w ? { ...w, stocks: w.stocks.filter((s) => s.symbol !== symbol) } : null));
    await api.removeStock(watchlistId, symbol);
  }

  if (!watchlist) {
    return <Skeleton className="h-64 w-full" />;
  }

  const watchedSymbols = new Set(watchlist.stocks.map((s) => s.symbol));
  const displayResults = debouncedQuery.trim() ? results : [];

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-white">{watchlist.name}</h1>
      <p className="mt-1 text-sm text-white/40">{watchlist.stocks.length} symbols tracked</p>

      <div className="relative mt-6 max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ticker or company name..."
          className="glass w-full rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 outline-none focus:border-signal-500/50"
        />
        <AnimatePresence>
          {displayResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="glass absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl"
            >
              {displayResults.map((r) => {
                const already = watchedSymbols.has(r.symbol);
                return (
                  <button
                    key={r.symbol}
                    disabled={already || adding === r.symbol}
                    onClick={() => addStock(r.symbol)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-white/5 disabled:opacity-40"
                  >
                    <span>
                      <span className="font-mono font-semibold text-white">{r.symbol}</span>
                      <span className="ml-2 text-white/40">{r.companyName}</span>
                    </span>
                    <span className="text-xs text-signal-400">{already ? "Added" : "+ Add"}</span>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {watchlist.stocks.map((s) => (
            <motion.div
              key={s.symbol}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Card className="flex items-center justify-between !p-4">
                <div>
                  <p className="font-mono text-sm font-semibold text-white">{s.symbol}</p>
                  <p className="text-xs text-white/40">{s.companyName}</p>
                </div>
                <button
                  onClick={() => removeStock(s.symbol)}
                  className="rounded-full p-1.5 text-white/30 hover:bg-white/10 hover:text-white"
                  aria-label={`Remove ${s.symbol}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
