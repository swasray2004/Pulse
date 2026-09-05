import { NextRequest, NextResponse } from "next/server";
import { detectMarketChange } from "@/lib/change-service";

export async function GET(request: NextRequest) {
    try {
        const symbol = request.nextUrl.searchParams.get("symbol");

        if (!symbol) {
            return NextResponse.json(
                { error: "symbol is required" },
                { status: 400 },
            );
        }

        const change = await detectMarketChange(symbol);

        if (!change) {
            return NextResponse.json(
                {
                    error:
                        "At least two market snapshots are required to detect a change",
                },
                { status: 404 },
            );
        }

        return NextResponse.json(change);
    } catch (error) {
        console.error("Failed to detect market change:", error);

        return NextResponse.json(
            { error: "Failed to detect market change" },
            { status: 500 },
        );
    }
}