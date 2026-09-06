import {
    computeAttentionScore,
} from "@/domain/attention-score";

import {
    classifyState,
} from "@/domain/state-classifier";

import {
    DEFAULT_PREFERENCES,
    type ChangeWindowInput,
    type MarketEventInput,
    type UserPreferenceInput,
} from "@/domain/types";

import { prisma } from "@/lib/prisma";

export async function analyzeStock(
    symbol: string,
    preferences: UserPreferenceInput = DEFAULT_PREFERENCES,
    preloadedData?: {
        snapshots?: Array<{ price: number; volume: number; timestamp: Date }>;
        events?: Array<{ symbol: string; type: string; headline: string; timestamp: Date }>;
    },
) {
    const normalizedSymbol = symbol.trim().toUpperCase();

    let snapshots = preloadedData?.snapshots;
    let events = preloadedData?.events;

    if (!snapshots || !events) {
        const [loadedSnapshots, loadedEvents] = await Promise.all([
            snapshots
                ? Promise.resolve(snapshots)
                : prisma.marketSnapshot.findMany({
                      where: {
                          symbol: normalizedSymbol,
                      },
                      orderBy: {
                          timestamp: "desc",
                      },
                      take: 2,
                  }),
            events
                ? Promise.resolve(events)
                : prisma.marketEvent.findMany({
                      where: {
                          symbol: normalizedSymbol,
                      },
                      orderBy: {
                          timestamp: "desc",
                      },
                      take: 5,
                  }),
        ]);
        snapshots = loadedSnapshots;
        events = loadedEvents;
    }

    if (snapshots.length < 2) {
        return null;
    }

    const [current, previous] = snapshots;

    const normalVolume = previous.volume;

    const validEventTypes: MarketEventInput["type"][] = [
        "earnings",
        "news",
        "guidance",
        "52w_high",
        "52w_low",
        "analyst_action",
        "other",
    ];

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

        historicalVolatilityPct: 1.5,

        events: events.map((e) => {
            const eventType = validEventTypes.includes(e.type as MarketEventInput["type"])
                ? (e.type as MarketEventInput["type"])
                : "other";
            return {
                symbol: e.symbol,
                type: eventType,
                headline: e.headline,
                timestamp: e.timestamp,
            };
        }),

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