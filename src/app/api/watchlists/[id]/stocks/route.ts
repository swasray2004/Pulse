import { NextRequest, NextResponse } from "next/server";
import {
    addStockToWatchlist,
    getWatchlistStocks,
} from "@/lib/watchlist-stock-service";
import { findStock } from "@/lib/stock-universe";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(
    _request: NextRequest,
    { params }: RouteContext,
) {
    try {
        const session = await getAuthSession();
        if (!session.userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        const watchlist = await prisma.watchlist.findFirst({
            where: { id, userId: session.userId },
        });

        if (!watchlist) {
            return NextResponse.json(
                { error: "Watchlist not found" },
                { status: 404 },
            );
        }

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
        const session = await getAuthSession();
        if (!session.userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        const watchlist = await prisma.watchlist.findFirst({
            where: { id, userId: session.userId },
        });

        if (!watchlist) {
            return NextResponse.json(
                { error: "Watchlist not found" },
                { status: 404 },
            );
        }

        const body = await request.json();

        const rawSymbol = body?.symbol;
        let { companyName, exchange, sector } = body;

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

        // If companyName is not supplied by the client, resolve it from the
        // stock universe. This allows api.addStock(id, symbol) to work without
        // requiring the caller to pass a company name.
        if (!companyName || typeof companyName !== "string") {
            const info = findStock(symbol);
            if (info) {
                companyName = info.companyName;
                exchange = exchange ?? info.exchange;
                sector = sector ?? info.sector;
            } else {
                companyName = symbol.toUpperCase();
            }
        }

        try {
            const stock = await addStockToWatchlist(
                id,
                symbol,
                companyName,
                exchange,
                sector,
            );

            return NextResponse.json({ stock }, { status: 201 });
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