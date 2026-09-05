import { NextResponse } from "next/server";
import { analyzeWatchlistPulse } from "@/lib/watchlist-pulse-service";

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(
    _request: Request,
    context: RouteContext,
) {
    try {
        const { id } = await context.params;

        if (!id) {
            return NextResponse.json(
                { error: "watchlist id is required" },
                { status: 400 },
            );
        }

        const pulse = await analyzeWatchlistPulse(id);

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