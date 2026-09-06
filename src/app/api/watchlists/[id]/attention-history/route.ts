import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeAttentionScore } from "@/domain/attention-score";
import { DEFAULT_PREFERENCES } from "@/domain/types";

type RouteContext = {
    params: Promise<{ id: string }>;
};

function toDateKey(d: Date): string {
    return d.toISOString().slice(0, 10);
}

export async function GET(
    _request: Request,
    context: RouteContext,
) {
    try {
        const session = await getAuthSession();
        if (!session.userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await context.params;

        // Verify watchlist belongs to this user
        const watchlist = await prisma.watchlist.findFirst({
            where: { id, userId: session.userId },
            include: { stocks: { select: { symbol: true, companyName: true, sector: true } } },
        });

        if (!watchlist) {
            return NextResponse.json(
                { error: "Watchlist not found" },
                { status: 404 },
            );
        }

        const symbols = watchlist.stocks.map((s) => s.symbol);

        if (symbols.length === 0) {
            return NextResponse.json({ ticks: [], currentScore: 0 });
        }

        // Fetch up to 90 days of snapshots for all watchlist stocks
        const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

        const snapshots = await prisma.marketSnapshot.findMany({
            where: {
                symbol: { in: symbols },
                timestamp: { gte: since },
            },
            orderBy: { timestamp: "asc" },
            select: {
                symbol: true,
                price: true,
                volume: true,
                timestamp: true,
            },
        });

        if (snapshots.length < 2) {
            return NextResponse.json({ ticks: [], currentScore: 0 });
        }

        // Group snapshots by symbol
        const bySymbol = new Map<string, typeof snapshots>();
        for (const snap of snapshots) {
            const arr = bySymbol.get(snap.symbol) ?? [];
            arr.push(snap);
            bySymbol.set(snap.symbol, arr);
        }

        // Observation changes per symbol
        const events: Array<{ timestamp: Date; symbol: string; score: number }> = [];

        for (const [sym, snaps] of bySymbol) {
            for (let i = 1; i < snaps.length; i++) {
                const prev = snaps[i - 1]!;
                const cur = snaps[i]!;

                if (cur.timestamp.getTime() === prev.timestamp.getTime()) continue;

                const attention = computeAttentionScore(
                    {
                        symbol: sym,
                        companyName: sym,
                        sector: "Unknown",
                        priceFrom: prev.price,
                        priceTo: cur.price,
                        normalVolume: prev.volume,
                        currentVolume: cur.volume,
                        benchmarkChangePct: 0,
                        sectorChangePct: 0,
                        fiftyTwoWeekHigh: cur.price,
                        fiftyTwoWeekLow: cur.price,
                        historicalVolatilityPct: 1.5,
                        events: [],
                        windowStart: prev.timestamp,
                        windowEnd: cur.timestamp,
                    },
                    DEFAULT_PREFERENCES,
                );

                events.push({
                    timestamp: cur.timestamp,
                    symbol: sym,
                    score: attention.score,
                });
            }
        }

        if (events.length === 0) {
            return NextResponse.json({ ticks: [], currentScore: 0 });
        }

        // Baseline timestamp (earliest snapshot)
        const initialTimes = Array.from(bySymbol.values())
            .map((s) => s[0]?.timestamp)
            .filter(Boolean) as Date[];
        const minTime = new Date(Math.min(...initialTimes.map((t) => t.getTime())));

        events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        // Running scores across all watchlist stocks
        const symbolScores = new Map<string, number>();
        for (const sym of symbols) {
            symbolScores.set(sym, 15); // baseline quiet score
        }

        const ticks: Array<{ timestamp: string; date: string; score: number; stockCount: number }> = [];

        // Initial baseline point
        ticks.push({
            timestamp: minTime.toISOString(),
            date: toDateKey(minTime),
            score: 15,
            stockCount: symbols.length,
        });

        let lastTime = minTime.getTime();
        for (const ev of events) {
            symbolScores.set(ev.symbol, ev.score);
            const total = Array.from(symbolScores.values()).reduce((a, b) => a + b, 0);
            const avg = Math.round(total / symbols.length);

            const evTime = ev.timestamp.getTime();
            // If more than 60s apart or only baseline exists, create new tick
            if (evTime - lastTime > 60000 || ticks.length === 1) {
                ticks.push({
                    timestamp: ev.timestamp.toISOString(),
                    date: toDateKey(ev.timestamp),
                    score: avg,
                    stockCount: symbols.length,
                });
                lastTime = evTime;
            } else {
                ticks[ticks.length - 1].score = avg;
                ticks[ticks.length - 1].timestamp = ev.timestamp.toISOString();
            }
        }

        const currentScore = ticks.length > 0 ? ticks[ticks.length - 1].score : 0;

        return NextResponse.json({ ticks, currentScore });
    } catch (error) {
        console.error("Failed to compute attention history:", error);
        return NextResponse.json(
            { error: "Failed to compute attention history" },
            { status: 500 },
        );
    }
}
