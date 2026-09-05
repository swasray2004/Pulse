import { NextRequest, NextResponse } from "next/server";
import { checkInToWatchlist } from "@/lib/visit-service";
import { getAuthSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const session = await getAuthSession();
        if (!session.userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const watchlistId = searchParams.get("watchlistId");

        if (!watchlistId) {
            return NextResponse.json(
                { error: "watchlistId is required" },
                { status: 400 },
            );
        }

        const result = await checkInToWatchlist(session.userId, watchlistId);

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

/**
 * POST /api/visits/check-in
 * Body: { watchlistId: string }
 *
 * Used by the "I'm caught up" button in the While Away page.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getAuthSession();
        if (!session.userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const watchlistId = body?.watchlistId;

        if (!watchlistId || typeof watchlistId !== "string") {
            return NextResponse.json(
                { error: "watchlistId is required" },
                { status: 400 },
            );
        }

        const result = await checkInToWatchlist(session.userId, watchlistId);

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Failed to check in";

        if (message === "Watchlist not found") {
            return NextResponse.json({ error: message }, { status: 404 });
        }

        console.error("Visit check-in (POST) failed:", error);

        return NextResponse.json(
            { error: "Failed to check in to watchlist" },
            { status: 500 },
        );
    }
}