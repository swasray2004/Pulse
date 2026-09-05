import { summarizeAbsence } from "@/domain/change-detection";
import {
    DEFAULT_PREFERENCES,
    type ChangeWindowInput,
} from "@/domain/types";
import { prisma } from "@/lib/prisma";

export async function checkInToWatchlist(
    userId: string,
    watchlistId: string,
) {
    const watchlist = await prisma.watchlist.findFirst({
        where: {
            id: watchlistId,
            userId,
        },
        include: {
            stocks: {
                orderBy: { position: "asc" },
            },
        },
    });

    if (!watchlist) {
        throw new Error("Watchlist not found");
    }

    // Read the previous visit BEFORE updating it.
    // This timestamp defines the "while you were away" window.
    const previousVisit = await prisma.userVisit.findFirst({
        where: {
            userId,
            watchlistId,
        },
        orderBy: {
            lastCheckedAt: "desc",
        },
    });

    const previousCheckedAt = previousVisit?.lastCheckedAt ?? null;

    const inputs: ChangeWindowInput[] = [];

    for (const stock of watchlist.stocks) {
        const latest = await prisma.marketSnapshot.findFirst({
            where: {
                symbol: stock.symbol,
            },
            orderBy: {
                timestamp: "desc",
            },
        });

        if (!latest) {
            continue;
        }

        // First visit: there is no baseline yet.
        // We cannot claim a change without a previous observation.
        if (!previousCheckedAt) {
            continue;
        }

        // Find the latest market observation that existed
        // when the user last checked the watchlist.
        const previous = await prisma.marketSnapshot.findFirst({
            where: {
                symbol: stock.symbol,
                timestamp: {
                    lte: previousCheckedAt,
                },
            },
            orderBy: {
                timestamp: "desc",
            },
        });

        if (!previous || latest.timestamp <= previousCheckedAt) {
            continue;
        }

        const priceChangePct =
            previous.price === 0
                ? 0
                : ((latest.price - previous.price) / previous.price) * 100;

        inputs.push({
            symbol: stock.symbol,
            companyName: stock.companyName,
            sector: stock.sector,

            priceFrom: previous.price,
            priceTo: latest.price,

            normalVolume: previous.volume,
            currentVolume: latest.volume,

            benchmarkChangePct: 0,
            sectorChangePct: 0,

            fiftyTwoWeekHigh: latest.price,
            fiftyTwoWeekLow: latest.price,

            historicalVolatilityPct: Math.max(
                Math.abs(priceChangePct),
                0.5,
            ),

            events: [],

            windowStart: previous.timestamp,
            windowEnd: latest.timestamp,
        });
    }

    /*
     * summarizeAbsence owns the domain logic for:
     * - attention scoring
     * - meaningful vs. noise changes
     * - long-absence capping
     * - selecting top signals
     */
    const absenceSummary = previousVisit
        ? summarizeAbsence(
            inputs,
            previousVisit.lastCheckedAt,
            DEFAULT_PREFERENCES,
        )
        : null;

    const meaningfulChanges = absenceSummary?.topSignals ?? [];

    // Persist meaningful changes.
    if (meaningfulChanges.length > 0) {
        await prisma.detectedChange.createMany({
            data: meaningfulChanges.map((change) => {
                const input = inputs.find(
                    (item) =>
                        item.symbol === change.symbol &&
                        item.windowStart.getTime() === change.windowStart.getTime() &&
                        item.windowEnd.getTime() === change.windowEnd.getTime(),
                );

                if (!input) {
                    throw new Error(
                        `Could not find source input for detected change: ${change.symbol}`,
                    );
                }

                return {
                    userId,
                    watchlistId,
                    symbol: change.symbol,
                    attentionScore: change.attention.score,
                    classification: change.attention.classification,
                    state: change.state,
                    reason: change.attention.reason,
                    signals: JSON.parse(JSON.stringify(change.attention.signals)),
                    priceFrom: input.priceFrom,
                    priceTo: input.priceTo,
                    windowStart: change.windowStart,
                    windowEnd: change.windowEnd,
                };
            }),
        });
    }

    // Only update UserVisit AFTER calculating and persisting changes.
    const checkedAt = new Date();

    const visit = previousVisit
        ? await prisma.userVisit.update({
            where: {
                id: previousVisit.id,
            },
            data: {
                lastCheckedAt: checkedAt,
            },
        })
        : await prisma.userVisit.create({
            data: {
                userId,
                watchlistId,
                lastCheckedAt: checkedAt,
            },
        });

    return {
        watchlist: {
            id: watchlist.id,
            name: watchlist.name,
        },

        previousCheckedAt,

        checkedAt: visit.lastCheckedAt,

        absence: absenceSummary
            ? {
                awayLabel: absenceSummary.awayLabel,
                isLongAbsence: absenceSummary.isLongAbsence,
                totalMovements: absenceSummary.totalMovements,
                meaningfulCount: absenceSummary.meaningfulCount,
                filteredCount: absenceSummary.filteredCount,
            }
            : null,

        changes: meaningfulChanges.map((change) => ({
            symbol: change.symbol,
            companyName: change.companyName,
            attention: {
                score: change.attention.score,
                classification: change.attention.classification,
                reason: change.attention.reason,
                signals: change.attention.signals,
                priceChangePct: change.attention.priceChangePct,
                relativeToBenchmarkPct: change.attention.relativeToBenchmarkPct,
                relativeToSectorPct: change.attention.relativeToSectorPct,
                volumeRatio: change.attention.volumeRatio,
            },
            state: change.state,
            windowStart: change.windowStart,
            windowEnd: change.windowEnd,
        })),

        summary: {
            totalStocks: watchlist.stocks.length,
            changesDetected: meaningfulChanges.length,
        },
    };
}