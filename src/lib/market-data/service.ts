/**
 * MarketDataService — the single entry-point for real market data ingestion.
 *
 * Responsibilities:
 *   1. Normalize the requested symbol.
 *   2. Deduplicate: if a fresh snapshot exists within DEDUP_WINDOW_MS, return it.
 *   3. Call the external provider via IMarketDataProvider.
 *   4. Validate the response.
 *   5. Persist a MarketSnapshot (append-only).
 *   6. Return a normalized MarketQuote { isStale: false }.
 *
 * On ANY provider failure:
 *   - Query the latest stored MarketSnapshot.
 *   - Return it as MarketQuote { isStale: true }.
 *   - Never throw. Never fabricate a price.
 *   - If no snapshot exists at all, return null.
 *
 * This file is server-side only. It must never be imported from client
 * components.
 */

import { prisma } from "@/lib/prisma";
import type { IMarketDataProvider } from "./provider";
import type { MarketQuote } from "./types";
import { MarketDataError } from "./types";
import { createAlphaVantageProvider } from "./alpha-vantage";

/** Do not call the external API again if a snapshot for the same symbol
 *  from the same source already exists within this window. */
const DEDUP_WINDOW_MS = 5 * 60 * 1_000; // 5 minutes

/** Reliability weight stored in MarketSnapshot.reliability. */
const LIVE_RELIABILITY = 0.85;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a MarketQuote from a raw Prisma MarketSnapshot row.
 * The `isStale` flag must be provided by the caller.
 */
function quoteFromSnapshot(
  snapshot: {
    symbol: string;
    price: number;
    volume: number;
    source: string;
    timestamp: Date;
  },
  isStale: boolean,
): MarketQuote {
  return {
    symbol: snapshot.symbol,
    price: snapshot.price,
    volume: snapshot.volume,
    timestamp: snapshot.timestamp,
    source: snapshot.source,
    isStale,
  };
}

// ── MarketDataService ─────────────────────────────────────────────────────────

export class MarketDataService {
  private readonly provider: IMarketDataProvider | null;

  /**
   * @param provider  An IMarketDataProvider implementation, or null to run in
   *                  fallback-only mode (returns stored snapshots as stale).
   */
  constructor(provider: IMarketDataProvider | null) {
    this.provider = provider;
  }

  /**
   * Fetch a live quote and persist it, or fall back to the latest stored
   * snapshot.
   *
   * Never throws. Returns null only when no snapshot exists at all and the
   * provider is unavailable.
   */
  async fetchAndPersist(symbol: string): Promise<MarketQuote | null> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // ── Step 1: No provider configured → stale fallback ──────────────────────
    if (!this.provider) {
      return this.staleOrNull(normalizedSymbol, "no provider configured");
    }

    // ── Step 2: Deduplication check ───────────────────────────────────────────
    const dedupSince = new Date(Date.now() - DEDUP_WINDOW_MS);
    const recentSnapshot = await prisma.marketSnapshot.findFirst({
      where: {
        symbol: normalizedSymbol,
        source: this.provider.sourceId,
        receivedAt: { gte: dedupSince },
      },
      orderBy: { receivedAt: "desc" },
    });

    if (recentSnapshot) {
      // Already fetched within the dedup window — return it as non-stale
      return quoteFromSnapshot(recentSnapshot, false);
    }

    // ── Step 3: Call the external provider ────────────────────────────────────
    let quote: MarketQuote;
    try {
      quote = await this.provider.fetchQuote(normalizedSymbol);
    } catch (err) {
      // All provider errors → stale fallback
      const reason =
        err instanceof MarketDataError
          ? `${err.kind}: ${err.message}`
          : String(err);
      console.warn(
        `[MarketDataService] Provider error for ${normalizedSymbol}, using fallback. Reason: ${reason}`,
      );
      return this.staleOrNull(normalizedSymbol, reason);
    }

    // ── Step 4: Extra validation post-fetch ───────────────────────────────────
    if (!Number.isFinite(quote.price) || quote.price <= 0) {
      console.warn(
        `[MarketDataService] Invalid price from provider for ${normalizedSymbol}: ${quote.price}`,
      );
      return this.staleOrNull(normalizedSymbol, "invalid price from provider");
    }

    // ── Step 5: Persist (append-only) ────────────────────────────────────────
    try {
      await prisma.marketSnapshot.create({
        data: {
          symbol: normalizedSymbol,
          price: quote.price,
          volume: quote.volume ?? 0,
          source: quote.source,
          reliability: LIVE_RELIABILITY,
          timestamp: quote.timestamp,
          raw: { provider: quote.source, isLive: true } as object,
        },
      });
    } catch (persistErr) {
      // Persist failed (e.g. duplicate unique constraint if schema adds one in
      // the future, or transient DB error). Log and still return the quote —
      // the caller gets the data even if we couldn't store it.
      console.error(
        `[MarketDataService] Failed to persist snapshot for ${normalizedSymbol}:`,
        persistErr,
      );
    }

    return quote;
  }

  /**
   * Return the latest stored snapshot as a stale quote, or null if none exists.
   */
  private async staleOrNull(
    symbol: string,
    reason: string,
  ): Promise<MarketQuote | null> {
    const snapshot = await prisma.marketSnapshot.findFirst({
      where: { symbol },
      orderBy: { timestamp: "desc" },
    });

    if (!snapshot) {
      console.warn(
        `[MarketDataService] No stored snapshot for ${symbol} either. Returning null. Reason: ${reason}`,
      );
      return null;
    }

    return quoteFromSnapshot(snapshot, true /* isStale */);
  }
}

// ── Module-level singleton ────────────────────────────────────────────────────

let _service: MarketDataService | undefined;

/**
 * Returns a lazily-initialised MarketDataService using the Alpha Vantage
 * provider when MARKET_DATA_API_KEY is set, or a fallback-only instance when
 * it is not.
 *
 * Call this from server-side code (API routes, server components, etc.).
 */
export function getMarketDataService(): MarketDataService {
  if (!_service) {
    const provider = createAlphaVantageProvider();
    if (!provider) {
      console.info(
        "[MarketDataService] MARKET_DATA_API_KEY not set — running in " +
          "fallback-only mode. Quotes will be served from stored snapshots.",
      );
    }
    _service = new MarketDataService(provider);
  }
  return _service;
}
