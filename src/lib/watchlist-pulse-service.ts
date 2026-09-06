import { prisma } from "@/lib/prisma";
import { analyzeStock } from "@/lib/pulse-service";
import { summarizeAbsence } from "@/domain/change-detection";
import { DEFAULT_PREFERENCES, type ChangeWindowInput } from "@/domain/types";

export async function analyzeWatchlistPulse(watchlistId: string, userId: string) {
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

    // ── 1. Read the user's PREVIOUS visit timestamp BEFORE touching anything ──
    // This defines the "while you were away" window.
    const previousVisit = await prisma.userVisit.findFirst({
        where: { userId, watchlistId },
        orderBy: { lastCheckedAt: "desc" },
    });

    const previousCheckedAt = previousVisit?.lastCheckedAt ?? null;

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
    const snapshotsBySymbol = new Map<
        string,
        Array<{ price: number; volume: number; timestamp: Date }>
    >();
    for (const snap of allSnapshots) {
        const list = snapshotsBySymbol.get(snap.symbol);
        if (!list) {
            snapshotsBySymbol.set(snap.symbol, [snap]);
        } else if (list.length < 2) {
            list.push(snap);
        }
    }

    // Group events by symbol (take at most 5 per symbol)
    const eventsBySymbol = new Map<
        string,
        Array<{ symbol: string; type: string; headline: string; timestamp: Date }>
    >();
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

    // ── 2. Compute real away summary from actual previousCheckedAt ──
    // If there is no previous visit, awaySummary is null — the caller
    // should treat this as a first-time visitor and skip the away banner.
    let awaySummary: {
        awayLabel: string;
        isLongAbsence: boolean;
        totalMovements: number;
        meaningfulCount: number;
        filteredCount: number;
    } | null = null;

    if (previousCheckedAt !== null) {
        // Build ChangeWindowInput list from the items that have both price points
        const changeInputs: ChangeWindowInput[] = items
            .filter((item) => item.windowStart && item.windowEnd)
            .map((item) => {
                const snapshots = snapshotsBySymbol.get(item.symbol.trim().toUpperCase()) ?? [];
                const [latest, previous] = snapshots;
                return {
                    symbol: item.symbol,
                    companyName: item.companyName,
                    sector: "",
                    priceFrom: previous?.price ?? latest?.price ?? 0,
                    priceTo: latest?.price ?? 0,
                    normalVolume: previous?.volume ?? latest?.volume ?? 0,
                    currentVolume: latest?.volume ?? 0,
                    benchmarkChangePct: 0,
                    sectorChangePct: 0,
                    fiftyTwoWeekHigh: latest?.price ?? 0,
                    fiftyTwoWeekLow: latest?.price ?? 0,
                    historicalVolatilityPct: Math.max(Math.abs(item.priceChangePct), 0.5),
                    events: [],
                    windowStart: new Date(item.windowStart),
                    windowEnd: new Date(item.windowEnd),
                } satisfies ChangeWindowInput;
            });

        const summary = summarizeAbsence(changeInputs, previousCheckedAt, DEFAULT_PREFERENCES);

        awaySummary = {
            awayLabel: summary.awayLabel,
            isLongAbsence: summary.isLongAbsence,
            totalMovements: items.length,
            meaningfulCount: items.filter((i) => i.classification !== "NORMAL").length,
            filteredCount: items.filter((i) => i.classification === "NORMAL").length,
        };
    } else {
        // ── First visit: seed the UserVisit baseline ──────────────────────────
        // awaySummary stays null (returned to caller as "Welcome to Pulse"),
        // but we record lastCheckedAt = now so the NEXT load can calculate a
        // real away duration instead of staying on the first-visit state forever.
        await prisma.userVisit.create({
            data: {
                userId,
                watchlistId,
                lastCheckedAt: new Date(),
            },
        });
    }

    return {
        watchlist: {
            id: watchlist.id,
            name: watchlist.name,
        },
        awaySummary,
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