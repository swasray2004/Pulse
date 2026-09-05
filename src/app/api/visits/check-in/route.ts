import { NextRequest, NextResponse } from "next/server";
import { checkInToWatchlist } from "@/lib/visit-service";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const userId = searchParams.get("userId");
        const watchlistId = searchParams.get("watchlistId");

        if (!userId || !watchlistId) {
            return NextResponse.json(
                {
                    error: "userId and watchlistId are required",
                },
                { status: 400 },
            );
        }

        const result = await checkInToWatchlist(userId, watchlistId);

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Failed to check in";

        if (message === "Watchlist not found") {
            return NextResponse.json({ error: message }, { status: 404 });
        }

        console.error("Visit check-in failed:", error);

        return NextResponse.json(
            { error: "Failed to check in to watchlist" },
            { status: 500 },
        );
    }
}