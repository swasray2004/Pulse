import { NextRequest, NextResponse } from "next/server";
import { analyzeStock } from "@/lib/pulse-service";

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

        const result = await analyzeStock(symbol);

        if (!result) {
            return NextResponse.json(
                {
                    error:
                        "At least two market snapshots are required to analyze a stock",
                },
                { status: 404 },
            );
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("Failed to analyze stock:", error);

        return NextResponse.json(
            { error: "Failed to analyze stock" },
            { status: 500 },
        );
    }
}