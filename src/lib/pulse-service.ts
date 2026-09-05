import {
    computeAttentionScore,
} from "@/domain/attention-score";

import {
    classifyState,
} from "@/domain/state-classifier";

import {
    DEFAULT_PREFERENCES,
    type ChangeWindowInput,
    type UserPreferenceInput,
} from "@/domain/types";

import { prisma } from "@/lib/prisma";

export async function analyzeStock(
    symbol: string,
    preferences: UserPreferenceInput = DEFAULT_PREFERENCES,
) {
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

    const priceChangePct =
        previous.price === 0
            ? 0
            : ((current.price - previous.price) / previous.price) * 100;

    const normalVolume = previous.volume;

    const input: ChangeWindowInput = {
        symbol: normalizedSymbol,
        companyName: normalizedSymbol,
        sector: "Unknown",

        priceFrom: previous.price,
        priceTo: current.price,

        normalVolume,
        currentVolume: current.volume,

        benchmarkChangePct: 0,
        sectorChangePct: 0,

        fiftyTwoWeekHigh: current.price,
        fiftyTwoWeekLow: current.price,

        historicalVolatilityPct: Math.max(
            Math.abs(priceChangePct),
            0.5,
        ),

        events: [],

        windowStart: previous.timestamp,
        windowEnd: current.timestamp,
    };

    const attention = computeAttentionScore(
        input,
        preferences,
    );

    const state = classifyState(
        input,
        attention,
    );

    return {
        symbol: normalizedSymbol,
        attention,
        state,
        windowStart: previous.timestamp,
        windowEnd: current.timestamp,
    };
}