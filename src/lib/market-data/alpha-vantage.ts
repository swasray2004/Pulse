/**
 * Alpha Vantage market-data provider.
 *
 * Uses the GLOBAL_QUOTE endpoint (free tier, no billing required).
 * https://www.alphavantage.co/documentation/#latestprice
 *
 * IMPORTANT: this file must only be imported from server-side code.
 * The API key is read from process.env.MARKET_DATA_API_KEY — never use
 * NEXT_PUBLIC_MARKET_DATA_API_KEY.
 */

import type { IMarketDataProvider } from "./provider";
import type { MarketQuote } from "./types";
import { MarketDataError } from "./types";

/** Reliability weight assigned to Alpha Vantage observations (0..1). */
const AV_RELIABILITY = 0.85;

/** Request timeout in milliseconds. */
const FETCH_TIMEOUT_MS = 5_000;

/**
 * Maximum age (in hours) of the provider's reported trading day before we
 * treat the observation as STALE. Alpha Vantage free tier returns end-of-day
 * data after market close, so we allow up to 36 h (covers weekends + holidays).
 */
const MAX_OBSERVATION_AGE_HOURS = 36;

// Alpha Vantage GLOBAL_QUOTE response shape
interface AlphaVantageGlobalQuote {
  "01. symbol": string;
  "02. open": string;
  "03. high": string;
  "04. low": string;
  "05. price": string;
  "06. volume": string;
  "07. latest trading day": string; // "YYYY-MM-DD"
  "08. previous close": string;
  "09. change": string;
  "10. change percent": string;
}

interface AlphaVantageResponse {
  "Global Quote"?: AlphaVantageGlobalQuote;
  // Rate-limit / information responses
  Information?: string;
  Note?: string;
}

/**
 * Parse "YYYY-MM-DD" from Alpha Vantage into a UTC midnight Date.
 * We treat it as market close of that day (end of session).
 */
function parseTradingDay(dateStr: string): Date {
  // "2024-01-15" → UTC midnight of that day
  const d = new Date(`${dateStr}T16:00:00Z`); // approx market close in UTC
  if (isNaN(d.getTime())) {
    throw new MarketDataError(
      "MALFORMED_RESPONSE",
      `Cannot parse trading day: "${dateStr}"`,
    );
  }
  return d;
}

function parseFiniteNumber(
  raw: string | undefined,
  fieldName: string,
): number {
  if (raw === undefined || raw === "") {
    throw new MarketDataError(
      "MISSING_PRICE",
      `Alpha Vantage: missing field "${fieldName}"`,
    );
  }
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) {
    throw new MarketDataError(
      "INVALID_NUMERIC",
      `Alpha Vantage: non-finite value for "${fieldName}": "${raw}"`,
    );
  }
  return n;
}

export class AlphaVantageProvider implements IMarketDataProvider {
  readonly sourceId = "alpha-vantage";

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    apiKey?: string,
    baseUrl = "https://www.alphavantage.co",
  ) {
    if (!apiKey) {
      throw new MarketDataError(
        "MISSING_API_KEY",
        "MARKET_DATA_API_KEY is not set. " +
          "Add it to .env or set it in your environment.",
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async fetchQuote(symbol: string): Promise<MarketQuote> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    const url = new URL("/query", this.baseUrl);
    url.searchParams.set("function", "GLOBAL_QUOTE");
    url.searchParams.set("symbol", normalizedSymbol);
    url.searchParams.set("apikey", this.apiKey);

    // Timeout via AbortController
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      FETCH_TIMEOUT_MS,
    );

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { "User-Agent": "pulse-groww/1.0" },
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      if (
        err instanceof Error &&
        err.name === "AbortError"
      ) {
        throw new MarketDataError(
          "TIMEOUT",
          `Alpha Vantage request timed out after ${FETCH_TIMEOUT_MS}ms`,
        );
      }
      throw new MarketDataError(
        "NETWORK_FAILURE",
        `Alpha Vantage network error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      if (response.status === 429) {
        throw new MarketDataError(
          "RATE_LIMITED",
          `Alpha Vantage rate limit hit (HTTP 429)`,
          429,
        );
      }
      throw new MarketDataError(
        "HTTP_ERROR",
        `Alpha Vantage returned HTTP ${response.status}`,
        response.status,
      );
    }

    let body: AlphaVantageResponse;
    try {
      body = (await response.json()) as AlphaVantageResponse;
    } catch {
      throw new MarketDataError(
        "MALFORMED_RESPONSE",
        "Alpha Vantage returned non-JSON body",
      );
    }

    // Rate-limit / information messages arrive as HTTP 200 with a text field
    if (body.Information || body.Note) {
      throw new MarketDataError(
        "RATE_LIMITED",
        body.Information ?? body.Note ?? "Alpha Vantage rate limit or information message",
      );
    }

    const quote = body["Global Quote"];
    if (!quote || typeof quote !== "object") {
      throw new MarketDataError(
        "MALFORMED_RESPONSE",
        `Alpha Vantage: "Global Quote" object missing or empty for ${normalizedSymbol}`,
      );
    }

    // Validate price
    const price = parseFiniteNumber(quote["05. price"], "05. price");
    if (price <= 0) {
      throw new MarketDataError(
        "MISSING_PRICE",
        `Alpha Vantage: price is zero or negative for ${normalizedSymbol}`,
      );
    }

    // Volume is present but may be "0" for pre/post market; we allow it
    let volume: number | null = null;
    const rawVolume = quote["06. volume"];
    if (rawVolume !== undefined && rawVolume !== "") {
      const v = parseFloat(rawVolume);
      volume = Number.isFinite(v) ? v : null;
    }

    // Parse trading day into a timestamp
    const tradingDay = quote["07. latest trading day"];
    if (!tradingDay) {
      throw new MarketDataError(
        "MALFORMED_RESPONSE",
        `Alpha Vantage: "07. latest trading day" missing for ${normalizedSymbol}`,
      );
    }
    const timestamp = parseTradingDay(tradingDay);

    // Staleness guard: reject if the observation is older than our threshold
    const ageHours =
      (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);
    if (ageHours > MAX_OBSERVATION_AGE_HOURS) {
      throw new MarketDataError(
        "STALE_TIMESTAMP",
        `Alpha Vantage: observation for ${normalizedSymbol} is ${Math.round(ageHours)}h old (max ${MAX_OBSERVATION_AGE_HOURS}h)`,
      );
    }

    return {
      symbol: normalizedSymbol,
      price,
      volume,
      timestamp,
      source: this.sourceId,
      isStale: false,
    };
  }
}

/**
 * Singleton factory — returns null (not throws) when key is absent so the
 * service can decide to fall back gracefully.
 */
export function createAlphaVantageProvider(): AlphaVantageProvider | null {
  const key = process.env.MARKET_DATA_API_KEY;
  if (!key) return null;
  return new AlphaVantageProvider(key);
}
