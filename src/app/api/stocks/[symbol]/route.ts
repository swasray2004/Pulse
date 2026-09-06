import { NextRequest, NextResponse } from "next/server";
import { analyzeStock } from "@/lib/pulse-service";
import { findStock } from "@/lib/stock-universe";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PREFERENCES } from "@/domain/types";
import { getAuthSession } from "@/lib/auth";

type RouteContext = {
    params: Promise<{ symbol: string }>;
};

/**
 * GET /api/stocks/[symbol]?watchlistId=xxx
 *
 * Returns the full stock detail shape expected by stock/[symbol]/page.tsx:
 * {
 *   symbol, companyName,
 *   priceFrom, priceTo,
 *   fiftyTwoWeekHigh, fiftyTwoWeekLow,
 *   attention: { score, classification, reason, priceChangePct, volumeRatio,
 *                relativeToBenchmarkPct, relativeToSectorPct, signals },
 *   state,
 *   events,
 * }
 */
export async function GET(
    request: NextRequest,
    { params }: RouteContext,
) {
    try {
        const { symbol } = await params;
        const normalizedSymbol = (symbol ?? "").trim().toUpperCase();

        if (!normalizedSymbol || normalizedSymbol.length > 15 || !/^[A-Z0-9.-]+$/.test(normalizedSymbol)) {
            return NextResponse.json(
                { error: "Invalid stock symbol format" },
                { status: 400 },
            );
        }

        // Look up static metadata for company name / exchange.
        const info = findStock(normalizedSymbol);

        // Fetch user preferences for personalization (if logged in).
        let preferences = DEFAULT_PREFERENCES;
        try {
            const session = await getAuthSession();
            if (session.userId) {
                const pref = await prisma.userPreference.findUnique({
                    where: { userId: session.userId },
                });
                if (pref) {
                    preferences = {
                        priceSensitivity: pref.priceSensitivity,
                        volumeSensitivity: pref.volumeSensitivity,
                        newsSensitivity: pref.newsSensitivity,
                        eventSensitivity: pref.eventSensitivity,
                        relativePerformanceSensitivity: pref.relativePerformanceSensitivity,
                        breakoutSensitivity: pref.breakoutSensitivity,
                    };
                }
            }
        } catch {
            // Non-fatal: fall back to defaults
        }

        const analysis = await analyzeStock(normalizedSymbol, preferences);

        // Get all snapshots to compute 52w high/low from stored data.
        const snapshots = await prisma.marketSnapshot.findMany({
            where: { symbol: normalizedSymbol },
            orderBy: { timestamp: "desc" },
            take: 100,
        });

        const prices = snapshots.map((s) => s.price);
        const fiftyTwoWeekHigh = prices.length > 0 ? Math.max(...prices) : 0;
        const fiftyTwoWeekLow  = prices.length > 0 ? Math.min(...prices) : 0;

        // Latest two snapshots for priceFrom / priceTo
        const priceFrom = snapshots[1]?.price ?? snapshots[0]?.price ?? 0;
        const priceTo   = snapshots[0]?.price ?? 0;

        // Market events for this symbol (most recent 5)
        const events = await prisma.marketEvent.findMany({
            where: { symbol: normalizedSymbol },
            orderBy: { timestamp: "desc" },
            take: 5,
        });

        // Build history array from the already-fetched snapshots.
        // Reverse so the array is chronological (oldest → newest) for the chart.
        const history = [...snapshots]
            .filter((s) => typeof s.price === "number" && Number.isFinite(s.price))
            .reverse()
            .map((s) => ({
                timestamp: s.timestamp.toISOString(),
                price: s.price,
                volume: s.volume,
            }));

        if (!analysis) {
            // No snapshots available — return structural shell with zeros
            return NextResponse.json({
                symbol: normalizedSymbol,
                companyName: info?.companyName ?? normalizedSymbol,
                priceFrom,
                priceTo,
                fiftyTwoWeekHigh,
                fiftyTwoWeekLow,
                attention: {
                    score: 0,
                    classification: "NORMAL",
                    reason: "No market data available for this symbol yet.",
                    priceChangePct: 0,
                    volumeRatio: 1,
                    relativeToBenchmarkPct: 0,
                    relativeToSectorPct: 0,
                    signals: {
                        price: 0,
                        volume: 0,
                        relativePerformance: 0,
                        event: 0,
                        volatility: 0,
                        personalization: 0,
                    },
                },
                state: "NORMAL",
                events: events.map((e) => ({ type: e.type, headline: e.headline })),
                history,
            });
        }

        return NextResponse.json({
            symbol: normalizedSymbol,
            companyName: info?.companyName ?? normalizedSymbol,
            priceFrom,
            priceTo,
            fiftyTwoWeekHigh,
            fiftyTwoWeekLow,
            attention: {
                score: analysis.attention.score,
                classification: analysis.attention.classification,
                reason: analysis.attention.reason,
                priceChangePct: analysis.attention.priceChangePct,
                volumeRatio: analysis.attention.volumeRatio,
                relativeToBenchmarkPct: analysis.attention.relativeToBenchmarkPct ?? 0,
                relativeToSectorPct: analysis.attention.relativeToSectorPct ?? 0,
                signals: analysis.attention.signals ?? {
                    price: 0,
                    volume: 0,
                    relativePerformance: 0,
                    event: 0,
                    volatility: 0,
                    personalization: 0,
                },
            },
            state: analysis.state,
            events: events.map((e) => ({ type: e.type, headline: e.headline })),
            history,
        });
    } catch (error) {
        console.error("Failed to fetch stock detail:", error);
        return NextResponse.json(
            { error: "Failed to fetch stock detail" },
            { status: 500 },
        );
    }
}
