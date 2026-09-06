/**
 * Unit tests for MarketDataService.
 *
 * All tests use mocked providers and a mocked Prisma client.
 * No real network calls are made. No real database is needed.
 *
 * Test matrix:
 *   1. Valid provider response → snapshot persisted, isStale: false
 *   2. Malformed provider response → stale fallback
 *   3. Missing price → stale fallback
 *   4. Missing volume → null volume normalized, snapshot still persisted
 *   5. Provider throws (network failure) → stale fallback from DB
 *   6. No API key (provider is null) → stale fallback from DB
 *   7. Duplicate within dedup window → returns existing, no new row inserted
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { MarketDataService } from "../service";
import type { IMarketDataProvider } from "../provider";
import type { MarketQuote } from "../types";
import { MarketDataError } from "../types";

// ── Mock Prisma ───────────────────────────────────────────────────────────────
// We mock the entire "@/lib/prisma" module so no real DB is touched.

vi.mock("@/lib/prisma", () => {
  const findFirst = vi.fn();
  const create = vi.fn();

  return {
    prisma: {
      marketSnapshot: { findFirst, create },
    },
  };
});

// Grab the mocked fns after vi.mock runs
import { prisma } from "@/lib/prisma";
const mockFindFirst = prisma.marketSnapshot.findFirst as unknown as Mock;
const mockCreate = prisma.marketSnapshot.create as unknown as Mock;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const GOOD_QUOTE: MarketQuote = {
  symbol: "AAPL",
  price: 189.5,
  volume: 55_000_000,
  timestamp: new Date("2024-01-15T16:00:00Z"),
  source: "alpha-vantage",
  isStale: false,
};

const STORED_SNAPSHOT = {
  id: "snap_1",
  symbol: "AAPL",
  price: 185.0,
  volume: 40_000_000,
  source: "alpha-vantage",
  reliability: 0.85,
  timestamp: new Date("2024-01-14T16:00:00Z"),
  receivedAt: new Date("2024-01-14T16:05:00Z"),
  raw: null,
};

// ── Provider mocks ────────────────────────────────────────────────────────────

function makeProvider(
  overrides: Partial<IMarketDataProvider> = {},
): IMarketDataProvider {
  return {
    sourceId: "alpha-vantage",
    fetchQuote: vi.fn(async () => GOOD_QUOTE),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MarketDataService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Test 1: Valid response ─────────────────────────────────────────────────
  it("1. valid provider response → persists snapshot and returns isStale: false", async () => {
    // No dedup match
    mockFindFirst.mockResolvedValueOnce(null);
    // Persist succeeds
    mockCreate.mockResolvedValueOnce({ id: "snap_new", ...GOOD_QUOTE });

    const provider = makeProvider();
    const service = new MarketDataService(provider);
    const quote = await service.fetchAndPersist("AAPL");

    expect(quote).not.toBeNull();
    expect(quote!.isStale).toBe(false);
    expect(quote!.price).toBe(189.5);
    expect(quote!.symbol).toBe("AAPL");

    expect(provider.fetchQuote).toHaveBeenCalledWith("AAPL");
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          symbol: "AAPL",
          price: 189.5,
          source: "alpha-vantage",
        }),
      }),
    );
  });

  // ── Test 2: Malformed response ─────────────────────────────────────────────
  it("2. malformed provider response → returns stored snapshot as isStale: true", async () => {
    // No dedup match
    mockFindFirst.mockResolvedValueOnce(null);
    // Stored snapshot for fallback
    mockFindFirst.mockResolvedValueOnce(STORED_SNAPSHOT);

    const provider = makeProvider({
      fetchQuote: vi.fn(async () => {
        throw new MarketDataError(
          "MALFORMED_RESPONSE",
          '"Global Quote" object missing',
        );
      }),
    });

    const service = new MarketDataService(provider);
    const quote = await service.fetchAndPersist("AAPL");

    expect(quote).not.toBeNull();
    expect(quote!.isStale).toBe(true);
    expect(quote!.price).toBe(185.0);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // ── Test 3: Missing price ──────────────────────────────────────────────────
  it("3. missing price in provider response → stale fallback", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    mockFindFirst.mockResolvedValueOnce(STORED_SNAPSHOT);

    const provider = makeProvider({
      fetchQuote: vi.fn(async () => {
        throw new MarketDataError("MISSING_PRICE", "price is zero");
      }),
    });

    const service = new MarketDataService(provider);
    const quote = await service.fetchAndPersist("AAPL");

    expect(quote!.isStale).toBe(true);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // ── Test 4: Missing volume ─────────────────────────────────────────────────
  it("4. missing volume → null volume normalized, snapshot still persisted", async () => {
    const noVolumeQuote: MarketQuote = {
      ...GOOD_QUOTE,
      volume: null,
    };

    mockFindFirst.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValueOnce({ id: "snap_new" });

    const provider = makeProvider({
      fetchQuote: vi.fn(async () => noVolumeQuote),
    });

    const service = new MarketDataService(provider);
    const quote = await service.fetchAndPersist("AAPL");

    expect(quote).not.toBeNull();
    expect(quote!.isStale).toBe(false);
    expect(quote!.volume).toBeNull();

    // Prisma receives 0 for volume (the schema column is Float, not nullable)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ volume: 0 }),
      }),
    );
  });

  // ── Test 5: Provider throws (network failure) ──────────────────────────────
  it("5. network failure → falls back to stored snapshot, does not throw", async () => {
    // First findFirst = dedup check (no recent snapshot)
    mockFindFirst.mockResolvedValueOnce(null);
    // Second findFirst = stale fallback query
    mockFindFirst.mockResolvedValueOnce(STORED_SNAPSHOT);

    const provider = makeProvider({
      fetchQuote: vi.fn(async () => {
        throw new MarketDataError("NETWORK_FAILURE", "fetch failed");
      }),
    });

    const service = new MarketDataService(provider);

    // Must not throw, and must return stale data from DB
    const quote = await service.fetchAndPersist("AAPL");

    expect(quote).not.toBeNull();
    expect(quote!.isStale).toBe(true);
    expect(quote!.price).toBe(185.0);
    expect(mockCreate).not.toHaveBeenCalled();
  });


  // ── Test 6: No API key / no provider ──────────────────────────────────────
  it("6. no provider configured (missing API key) → returns stale fallback, does not crash", async () => {
    // findFirst for stale fallback
    mockFindFirst.mockResolvedValueOnce(STORED_SNAPSHOT);

    const service = new MarketDataService(null /* no provider */);
    const quote = await service.fetchAndPersist("AAPL");

    expect(quote).not.toBeNull();
    expect(quote!.isStale).toBe(true);
    expect(quote!.price).toBe(185.0);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // ── Test 7: Duplicate within dedup window ──────────────────────────────────
  it("7. snapshot exists within dedup window → returns it without calling provider or creating a new row", async () => {
    // Dedup check finds a recent snapshot
    mockFindFirst.mockResolvedValueOnce(STORED_SNAPSHOT);

    const provider = makeProvider();
    const service = new MarketDataService(provider);
    const quote = await service.fetchAndPersist("AAPL");

    expect(quote).not.toBeNull();
    // Returned as non-stale (it was a successful recent snapshot)
    expect(quote!.isStale).toBe(false);
    expect(quote!.price).toBe(185.0);

    // Provider was never called
    expect(provider.fetchQuote).not.toHaveBeenCalled();
    // No new row inserted
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
