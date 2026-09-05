import { NextRequest, NextResponse } from "next/server";
import {
    addStockToWatchlist,
    getWatchlistStocks,
} from "@/lib/watchlist-stock-service";

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(
    _request: NextRequest,
    { params }: RouteContext,
) {
    try {
        const { id } = await params;

        const stocks = await getWatchlistStocks(id);

        return NextResponse.json(stocks);
    } catch (error) {
        console.error("Failed to fetch watchlist stocks:", error);

        return NextResponse.json(
            { error: "Failed to fetch watchlist stocks" },
            { status: 500 },
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: RouteContext,
) {
    try {
        const { id } = await params;
        const body = await request.json();

        const { symbol, companyName, exchange, sector } = body;

        if (!symbol || typeof symbol !== "string") {
            return NextResponse.json(
                { error: "symbol is required" },
                { status: 400 },
            );
        }

        if (!companyName || typeof companyName !== "string") {
            return NextResponse.json(
                { error: "companyName is required" },
                { status: 400 },
            );
        }

        try {
            const stock = await addStockToWatchlist(
                id,
                symbol,
                companyName,
                exchange,
                sector,
            );

            return NextResponse.json(stock, { status: 201 });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Failed to add stock";

            if (message === "Watchlist not found") {
                return NextResponse.json(
                    { error: message },
                    { status: 404 },
                );
            }

            if (message === "Stock already exists in watchlist") {
                return NextResponse.json(
                    { error: message },
                    { status: 409 },
                );
            }

            return NextResponse.json(
                { error: message },
                { status: 400 },
            );
        }
    } catch (error) {
        console.error("Failed to add stock:", error);

        return NextResponse.json(
            { error: "Failed to add stock" },
            { status: 500 },
        );
    }
}