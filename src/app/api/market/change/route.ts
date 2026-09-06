import { NextRequest, NextResponse } from "next/server";
import { detectMarketChange } from "@/lib/change-service";

export async function GET(request: NextRequest) {
    try {
        const rawSymbol = request.nextUrl.searchParams.get("symbol");

        if (!rawSymbol || typeof rawSymbol !== "string" || !rawSymbol.trim()) {
            return NextResponse.json(
                { error: "symbol is required" },
                { status: 400 },
            );
        }

        const symbol = rawSymbol.trim().toUpperCase();
        if (symbol.length > 15 || !/^[A-Z0-9.-]+$/.test(symbol)) {
            return NextResponse.json(
                { error: "Invalid stock symbol format" },
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