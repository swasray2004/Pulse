import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/market/context?watchlistId=xxx
 *
 * Returns market context for a watchlist.
 * benchmarkChangePct and sectorChangePct are neutral (0) since no real
 * benchmark feed is connected. The UI uses these for display context only.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getAuthSession();
        if (!session.userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const watchlistId = request.nextUrl.searchParams.get("watchlistId");

        if (!watchlistId) {
            return NextResponse.json(
                { error: "watchlistId is required" },
                { status: 400 },
            );
        }

        // Look up the watchlist and verify ownership
        const watchlist = await prisma.watchlist.findFirst({
            where: { id: watchlistId, userId: session.userId },
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

        // Get the latest snapshot timestamp for context
        const latestSnapshot = await prisma.marketSnapshot.findFirst({
            where: {
                symbol: { in: watchlist.stocks.map((s) => s.symbol) },
            },
            orderBy: { timestamp: "desc" },
        });

        return NextResponse.json({
            watchlistId,
            watchlistName: watchlist.name,
            benchmarkChangePct: 0,
            sectorChangePct: 0,
            timestamp: latestSnapshot?.timestamp.toISOString() ?? new Date().toISOString(),
            note: "Benchmark and sector data not available in demo mode.",
        });
    } catch (error) {
        console.error("Failed to fetch market context:", error);
        return NextResponse.json(
            { error: "Failed to fetch market context" },
            { status: 500 },
        );
    }
}
