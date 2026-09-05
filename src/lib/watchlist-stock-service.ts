import { prisma } from "@/lib/prisma";

export async function getWatchlistStocks(watchlistId: string) {
    return prisma.watchlistStock.findMany({
        where: { watchlistId },
        orderBy: { position: "asc" },
    });
}

export async function addStockToWatchlist(
    watchlistId: string,
    symbol: string,
    companyName: string,
    exchange = "NASDAQ",
    sector = "Unknown",
) {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const normalizedCompanyName = companyName.trim();

    if (!normalizedSymbol) {
        throw new Error("Stock symbol cannot be empty");
    }

    if (!normalizedCompanyName) {
        throw new Error("Company name cannot be empty");
    }

    const watchlist = await prisma.watchlist.findUnique({
        where: { id: watchlistId },
    });

    if (!watchlist) {
        throw new Error("Watchlist not found");
    }

    const existingStock = await prisma.watchlistStock.findUnique({
        where: {
            watchlistId_symbol: {
                watchlistId,
                symbol: normalizedSymbol,
            },
        },
    });

    if (existingStock) {
        throw new Error("Stock already exists in watchlist");
    }

    const lastStock = await prisma.watchlistStock.findFirst({
        where: { watchlistId },
        orderBy: { position: "desc" },
    });

    const position = lastStock ? lastStock.position + 1 : 0;

    return prisma.watchlistStock.create({
        data: {
            watchlistId,
            symbol: normalizedSymbol,
            companyName: normalizedCompanyName,
            exchange,
            sector,
            position,
        },
    });
}