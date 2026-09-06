import { NextRequest, NextResponse } from "next/server";
import { searchUniverse } from "@/lib/stock-universe";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * GET /api/stocks/search?q=AAPL
 *
 * Returns up to 10 matching stocks from the static stock universe.
 * Shape matches what the watchlist detail page expects:
 *   { results: [{ symbol, companyName, exchange, sector }] }
 */
export async function GET(request: NextRequest) {
    try {
        const ip = getClientIp(request.headers);
        const rl = checkRateLimit(`search:${ip}`, { limit: 60, windowMs: 60 * 1000 });
        if (!rl.success) {
            return NextResponse.json(
                { error: "Search rate limit exceeded. Please slow down." },
                {
                    status: 429,
                    headers: { "Retry-After": String(rl.retryAfterSeconds ?? 10) },
                },
            );
        }

        const q = request.nextUrl.searchParams.get("q") ?? "";

        if (!q.trim()) {
            return NextResponse.json({ results: [] });
        }

        const results = searchUniverse(q, 10);

        return NextResponse.json({ results });
    } catch (error) {
        console.error("Stock search failed:", error);
        return NextResponse.json(
            { error: "Stock search failed" },
            { status: 500 },
        );
    }
}
