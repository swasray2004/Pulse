/**
 * Provider abstraction.
 *
 * Pulse never imports Alpha Vantage (or any other external data source)
 * directly. All external dependencies are hidden behind this interface so the
 * implementation can be swapped without touching the service or the domain
 * layer.
 */
import type { MarketQuote } from "./types";

export interface IMarketDataProvider {
  /**
   * Fetch a real-time (or delayed) quote for a single normalized symbol.
   *
   * Throws MarketDataError on any failure — missing key, network error,
   * malformed response, missing price, rate-limit, etc.
   * The service layer is responsible for catching and applying fallback logic.
   */
  fetchQuote(symbol: string): Promise<MarketQuote>;

  /** Stable identifier stored in MarketSnapshot.source, e.g. "alpha-vantage". */
  readonly sourceId: string;
}
