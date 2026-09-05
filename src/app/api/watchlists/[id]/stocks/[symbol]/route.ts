import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
    params: Promise<{
        id: string;
        symbol: string;
    }>;
};

export async function DELETE(
    _request: NextRequest,
    { params }: RouteContext,
) {
    try {
        const { id, symbol } = await params;

        const normalizedSymbol = symbol.trim().toUpperCase();

        const stock = await prisma.watchlistStock.findUnique({
            where: {
                watchlistId_symbol: {
                    watchlistId: id,
                    symbol: normalizedSymbol,
                },
            },
        });

        if (!stock) {
            return NextResponse.json(
                { error: "Stock not found in watchlist" },
                { status: 404 },
            );
        }

        await prisma.watchlistStock.delete({
            where: {
                id: stock.id,
            },
        });

        return NextResponse.json({
            success: true,
            symbol: normalizedSymbol,
        });
    } catch (error) {
        console.error("Failed to remove stock:", error);

        return NextResponse.json(
            { error: "Failed to remove stock" },
            { status: 500 },
        );
    }
}