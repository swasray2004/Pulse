import { NextRequest, NextResponse } from "next/server";
import {
    getLatestMarketSnapshot,
    saveMarketSnapshot,
} from "@/lib/market-service";
import { getAuthSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const symbol = request.nextUrl.searchParams.get("symbol");

        if (!symbol) {
            return NextResponse.json(
                { error: "symbol is required" },
                { status: 400 },
            );
        }

        const snapshot = await getLatestMarketSnapshot(symbol);

        if (!snapshot) {
            return NextResponse.json(
                { error: "Market snapshot not found" },
                { status: 404 },
            );
        }

        return NextResponse.json(snapshot);
    } catch (error) {
        console.error("Failed to fetch market snapshot:", error);

        return NextResponse.json(
            { error: "Failed to fetch market snapshot" },
            { status: 500 },
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getAuthSession();
        if (!session.userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        const {
            symbol,
            price,
            volume,
            timestamp,
            source,
            reliability,
        } = body;

        if (!symbol || typeof symbol !== "string") {
            return NextResponse.json(
                { error: "symbol is required" },
                { status: 400 },
            );
        }

        if (
            typeof price !== "number" ||
            !Number.isFinite(price) ||
            price < 0
        ) {
            return NextResponse.json(
                { error: "price must be a valid non-negative number" },
                { status: 400 },
            );
        }

        if (
            typeof volume !== "number" ||
            !Number.isFinite(volume) ||
            volume < 0
        ) {
            return NextResponse.json(
                { error: "volume must be a valid non-negative number" },
                { status: 400 },
            );
        }

        const snapshot = await saveMarketSnapshot({
            symbol,
            price,
            volume,
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            source: typeof source === "string" ? source : "manual",
            reliability:
                typeof reliability === "number" ? reliability : 0.9,
        });

        return NextResponse.json(snapshot, { status: 201 });
    } catch (error) {
        console.error("Failed to save market snapshot:", error);

        return NextResponse.json(
            { error: "Failed to save market snapshot" },
            { status: 500 },
        );
    }
}