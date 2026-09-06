/**
 * POST /api/market/ingest
 *
 * Server-side endpoint that triggers a live market-data fetch for a single
 * symbol, persists the result, and returns the normalized quote.
 *
 * This route is intentionally NOT called on every browser render. It is
 * designed for:
 *   - Cron jobs / scheduled refreshes (e.g. a Vercel cron function)
 *   - Seed / setup scripts
 *   - Manual refresh triggers from authenticated server actions
 *
 * Auth: requires a valid session (the user must be logged in).
 *       Returns 401 when unauthenticated.
 *
 * Request body: { "symbol": "NVDA" }
 *
 * Response (200):
 * {
 *   "symbol": "NVDA",
 *   "price": 123.45,
 *   "volume": 45000000,
 *   "timestamp": "2024-01-15T16:00:00.000Z",
 *   "source": "alpha-vantage",
 *   "isStale": false,
 *   "persisted": true
 * }
 *
 * When the provider is unavailable the response still returns 200 with
 * isStale: true and data from the latest stored snapshot. Returns 404 when
 * no data exists at all.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getMarketDataService } from "@/lib/market-data/service";

export async function POST(request: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  try {
    const session = await getAuthSession();
    if (!session.userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let symbol: unknown;
  try {
    const body = await request.json();
    symbol = body?.symbol;
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON with a 'symbol' field" },
      { status: 400 },
    );
  }

  if (typeof symbol !== "string" || !symbol.trim()) {
    return NextResponse.json(
      { error: "'symbol' is required and must be a non-empty string" },
      { status: 400 },
    );
  }

  const normalizedSymbol = symbol.trim().toUpperCase();

  // ── Fetch + persist ────────────────────────────────────────────────────────
  const service = getMarketDataService();
  const quote = await service.fetchAndPersist(normalizedSymbol);

  if (!quote) {
    return NextResponse.json(
      {
        error: `No market data available for ${normalizedSymbol}. ` +
          "The external provider is unreachable and no stored snapshot exists.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    symbol: quote.symbol,
    price: quote.price,
    volume: quote.volume,
    timestamp: quote.timestamp.toISOString(),
    source: quote.source,
    isStale: quote.isStale,
    // persisted: true when a fresh snapshot was written this request.
    // persisted: false when we returned an existing dedup snapshot or fallback.
    persisted: !quote.isStale,
  });
}
