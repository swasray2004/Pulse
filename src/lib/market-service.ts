import { prisma } from "@/lib/prisma";

export type MarketQuote = {
    symbol: string;
    price: number;
    volume: number;
    timestamp: Date;
    source: string;
    reliability: number;
};

export async function saveMarketSnapshot(quote: MarketQuote) {
    return prisma.marketSnapshot.create({
        data: {
            symbol: quote.symbol.trim().toUpperCase(),
            price: quote.price,
            volume: quote.volume,
            source: quote.source,
            reliability: quote.reliability,
            timestamp: quote.timestamp,
        },
    });
}

export async function getLatestMarketSnapshot(symbol: string) {
    return prisma.marketSnapshot.findFirst({
        where: {
            symbol: symbol.trim().toUpperCase(),
        },
        orderBy: {
            timestamp: "desc",
        },
    });
}

export async function getMarketSnapshots(
    symbol: string,
    limit = 20,
) {
    return prisma.marketSnapshot.findMany({
        where: {
            symbol: symbol.trim().toUpperCase(),
        },
        orderBy: {
            timestamp: "desc",
        },
        take: limit,
    });
}

/**
 * Return all snapshots for a symbol whose observation timestamp is >= since.
 * Useful for detecting whether we already have a fresh snapshot in a time
 * window without needing to call the external provider again.
 */
export async function getMarketSnapshotsSince(
    symbol: string,
    since: Date,
) {
    return prisma.marketSnapshot.findMany({
        where: {
            symbol: symbol.trim().toUpperCase(),
            timestamp: { gte: since },
        },
        orderBy: {
            timestamp: "desc",
        },
    });
}