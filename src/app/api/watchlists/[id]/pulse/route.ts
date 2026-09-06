import { NextResponse } from "next/server";
import { analyzeWatchlistPulse } from "@/lib/watchlist-pulse-service";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
    params: Promise<{ id: string }>;
};

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

        const watchlist = await prisma.watchlist.findFirst({
            where: { id, userId: session.userId },
        });

        if (!watchlist) {
            return NextResponse.json(
                { error: "Watchlist not found" },
                { status: 404 },
            );
        }

        const pulse = await analyzeWatchlistPulse(id, session.userId);

        return NextResponse.json(pulse);
    } catch (error) {
        console.error("Failed to analyze watchlist pulse:", error);

        if (error instanceof Error && error.message === "Watchlist not found") {
            return NextResponse.json(
                { error: "Watchlist not found" },
                { status: 404 },
            );
        }

        return NextResponse.json(
            { error: "Failed to analyze watchlist pulse" },
            { status: 500 },
        );
    }
}