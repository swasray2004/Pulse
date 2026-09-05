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

    const analyzed = await Promise.all(
        watchlist.stocks.map(async (stock) => {
            const analysis = await analyzeStock(stock.symbol);

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