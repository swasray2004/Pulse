import { prisma } from "@/lib/prisma";
import { analyzeStock } from "@/lib/pulse-service";

export async function analyzeWatchlistPulse(watchlistId: string) {
    const watchlist = await prisma.watchlist.findUnique({
        where: { id: watchlistId },
        include: {
            stocks: {
                orderBy: { position: "asc" },
            },
        },
    });

    if (!watchlist) {
        throw new Error("Watchlist not found");
    }

    const symbols = watchlist.stocks.map((s) => s.symbol.trim().toUpperCase());

    // Batch query snapshots and events for all symbols in the watchlist
    const [allSnapshots, allEvents] = await Promise.all([
        symbols.length > 0
            ? prisma.marketSnapshot.findMany({
                  where: { symbol: { in: symbols } },
                  orderBy: { timestamp: "desc" },
              })
            : Promise.resolve([]),
        symbols.length > 0
            ? prisma.marketEvent.findMany({
                  where: { symbol: { in: symbols } },
                  orderBy: { timestamp: "desc" },
              })
            : Promise.resolve([]),
    ]);

    // Group snapshots by symbol (take at most 2 per symbol)
    const snapshotsBySymbol = new Map<string, typeof allSnapshots>();
    for (const snap of allSnapshots) {
        const list = snapshotsBySymbol.get(snap.symbol);
        if (!list) {
            snapshotsBySymbol.set(snap.symbol, [snap]);
        } else if (list.length < 2) {
            list.push(snap);
        }
    }

    // Group events by symbol (take at most 5 per symbol)
    const eventsBySymbol = new Map<string, typeof allEvents>();
    for (const event of allEvents) {
        const list = eventsBySymbol.get(event.symbol);
        if (!list) {
            eventsBySymbol.set(event.symbol, [event]);
        } else if (list.length < 5) {
            list.push(event);
        }
    }

    const analyzed = await Promise.all(
        watchlist.stocks.map(async (stock) => {
            const sym = stock.symbol.trim().toUpperCase();
            const analysis = await analyzeStock(sym, undefined, {
                snapshots: snapshotsBySymbol.get(sym) || [],
                events: eventsBySymbol.get(sym) || [],
            });

            if (!analysis) {
                return null;
            }

            return {
                symbol: stock.symbol,
                companyName: stock.companyName,
                position: stock.position,
                score: analysis.attention.score,
                classification: analysis.attention.classification,
                state: analysis.state,
                reason: analysis.attention.reason,
                priceChangePct: analysis.attention.priceChangePct,
                volumeRatio: analysis.attention.volumeRatio,
                windowStart: analysis.windowStart,
                windowEnd: analysis.windowEnd,
            };
        }),
    );

    const items = analyzed
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => b.score - a.score);

    const highAttention = items.filter(
        (item) => item.classification === "HIGH_ATTENTION",
    ).length;

    const important = items.filter(
        (item) => item.classification === "IMPORTANT",
    ).length;

    const interesting = items.filter(
        (item) => item.classification === "INTERESTING",
    ).length;

    return {
        watchlist: {
            id: watchlist.id,
            name: watchlist.name,
        },
        summary: {
            totalStocks: watchlist.stocks.length,
            analyzedStocks: items.length,
            unavailableStocks: watchlist.stocks.length - items.length,
            highAttention,
            important,
            interesting,
        },
        items,
    };
}