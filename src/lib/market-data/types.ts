/**
 * Normalized types for the market-data ingestion layer.
 *
 * These types are the contract between the external provider and the rest of
 * Pulse. Nothing outside src/lib/market-data should depend on provider-specific
 * shapes; only MarketQuote and MarketDataError should cross that boundary.
 */

// ── Normalized quote ──────────────────────────────────────────────────────────

/**
 * A single price observation, normalized from whatever the external provider
 * returned.
 *
 * volume is nullable because some providers omit it for off-hours quotes.
 * isStale is true when the value was returned from a stored snapshot rather
 * than a live provider call.
 */
export interface MarketQuote {
  symbol: string;
  price: number;
  volume: number | null;
  /** The exchange timestamp carried by the provider (not our ingestion time). */
  timestamp: Date;
  /** Identifies the data source, e.g. "alpha-vantage" or "demo". */
  source: string;
  /**
   * true  → returned from a stored MarketSnapshot because the provider was
   *          unavailable, rate-limited, or the key is missing.
   * false → returned from a successful live provider call.
   */
  isStale: boolean;
}

// ── Error taxonomy ────────────────────────────────────────────────────────────

export type MarketDataErrorKind =
  | "MISSING_API_KEY"
  | "NETWORK_FAILURE"
  | "TIMEOUT"
  | "HTTP_ERROR"
  | "RATE_LIMITED"
  | "MISSING_PRICE"
  | "MISSING_VOLUME"
  | "MALFORMED_RESPONSE"
  | "INVALID_NUMERIC"
  | "STALE_TIMESTAMP"
  | "MARKET_CLOSED";

export class MarketDataError extends Error {
  readonly kind: MarketDataErrorKind;
  readonly statusCode?: number;

  constructor(
    kind: MarketDataErrorKind,
    message: string,
    statusCode?: number,
  ) {
    super(message);
    this.name = "MarketDataError";
    this.kind = kind;
    this.statusCode = statusCode;
  }
}
