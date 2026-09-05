import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

type RouteContext = {
    params: Promise<{ id: string }>;
};

interface Tick {
    time: string;
    symbol: string;
    price: number;
    kind: "price" | "event";
    label?: string;
}

/**
 * GET /api/watchlists/[id]/replay
 *
 * Returns a chronological replay of market data for all stocks in the
 * watchlist. Uses stored MarketSnapshot records — no fabricated prices.
 */
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

        if (!id) {
            return NextResponse.json(
                { error: "watchlist id is required" },
                { status: 400 },
            );
        }

        // Load watchlist with stocks, verifying ownership
        const watchlist = await prisma.watchlist.findFirst({
            where: { id, userId: session.userId },
            include: {
                stocks: { orderBy: { position: "asc" } },
            },
        });

        if (!watchlist) {
            return NextResponse.json(
                { error: "Watchlist not found" },
                { status: 404 },
            );
        }

        if (watchlist.stocks.length === 0) {
            return NextResponse.json({ start: new Date().toISOString(), end: new Date().toISOString(), ticks: [] });
        }

        const symbols = watchlist.stocks.map((s) => s.symbol);

        // Fetch up to 50 snapshots per symbol so replay doesn't get huge
        const snapshotRows = await prisma.marketSnapshot.findMany({
            where: { symbol: { in: symbols } },
            orderBy: { timestamp: "asc" },
            take: 500,
        });

        if (snapshotRows.length === 0) {
            return NextResponse.json({
                start: new Date().toISOString(),
                end: new Date().toISOString(),
                ticks: [],
            });
        }

        // Fetch market events for these symbols
        const eventRows = await prisma.marketEvent.findMany({
            where: { symbol: { in: symbols } },
            orderBy: { timestamp: "asc" },
        });

        // Build tick list from snapshots
        const ticks: Tick[] = snapshotRows.map((snap) => ({
            time: snap.timestamp.toISOString(),
            symbol: snap.symbol,
            price: snap.price,
            kind: "price" as const,
        }));

        // Interleave event ticks
        for (const evt of eventRows) {
            ticks.push({
                time: evt.timestamp.toISOString(),
                symbol: evt.symbol,
                price: 0,
                kind: "event" as const,
                label: `${evt.symbol}: ${evt.headline}`,
            });
        }

        // Sort all ticks chronologically
        ticks.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

        const start = ticks[0].time;
        const end = ticks[ticks.length - 1].time;

        return NextResponse.json({ start, end, ticks });
    } catch (error) {
        console.error("Failed to build replay:", error);
        return NextResponse.json(
            { error: "Failed to build replay" },
            { status: 500 },
        );
    }
}
