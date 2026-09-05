import { prisma } from "@/lib/prisma";

export type MarketChange = {
    symbol: string;
    previousPrice: number;
    currentPrice: number;
    priceChange: number;
    priceChangePercent: number;
    previousVolume: number;
    currentVolume: number;
    volumeChangePercent: number;
    previousTimestamp: Date;
    currentTimestamp: Date;
};

export async function detectMarketChange(
    symbol: string,
): Promise<MarketChange | null> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    const snapshots = await prisma.marketSnapshot.findMany({
        where: {
            symbol: normalizedSymbol,
        },
        orderBy: {
            timestamp: "desc",
        },
        take: 2,
    });

    if (snapshots.length < 2) {
        return null;
    }

    const [current, previous] = snapshots;

    const priceChange = current.price - previous.price;

    const priceChangePercent =
        previous.price === 0
            ? 0
            : (priceChange / previous.price) * 100;

    const volumeChangePercent =
        previous.volume === 0
            ? 0
            : ((current.volume - previous.volume) / previous.volume) * 100;

    return {
        symbol: normalizedSymbol,
        previousPrice: previous.price,
        currentPrice: current.price,
        priceChange,
        priceChangePercent,
        previousVolume: previous.volume,
        currentVolume: current.volume,
        volumeChangePercent,
        previousTimestamp: previous.timestamp,
        currentTimestamp: current.timestamp,
    };
}