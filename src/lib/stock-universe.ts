/**
 * Static stock universe for hackathon demo.
 *
 * This list is used ONLY for:
 *  - /api/stocks/search  (search results)
 *  - /api/watchlists/[id]/stocks POST (resolving companyName from symbol)
 *
 * It does NOT contain market prices and does not fabricate market data.
 * Prices come exclusively from MarketSnapshot records in PostgreSQL.
 */

export interface StockInfo {
  symbol: string;
  companyName: string;
  exchange: string;
  sector: string;
}

export const STOCK_UNIVERSE: StockInfo[] = [
  { symbol: "AAPL",    companyName: "Apple Inc.",                exchange: "NASDAQ", sector: "Technology" },
  { symbol: "MSFT",    companyName: "Microsoft Corporation",     exchange: "NASDAQ", sector: "Technology" },
  { symbol: "NVDA",    companyName: "NVIDIA Corporation",        exchange: "NASDAQ", sector: "Technology" },
  { symbol: "TSLA",    companyName: "Tesla, Inc.",               exchange: "NASDAQ", sector: "Consumer Cyclical" },
  { symbol: "AMZN",    companyName: "Amazon.com, Inc.",          exchange: "NASDAQ", sector: "Consumer Cyclical" },
  { symbol: "GOOGL",   companyName: "Alphabet Inc.",             exchange: "NASDAQ", sector: "Technology" },
  { symbol: "META",    companyName: "Meta Platforms, Inc.",      exchange: "NASDAQ", sector: "Technology" },
  { symbol: "TCS",     companyName: "Tata Consultancy Services", exchange: "NSE",    sector: "Technology" },
  { symbol: "INFY",    companyName: "Infosys Limited",           exchange: "NSE",    sector: "Technology" },
  { symbol: "RELIANCE",companyName: "Reliance Industries Ltd.",  exchange: "NSE",    sector: "Energy" },
  { symbol: "NFLX",    companyName: "Netflix, Inc.",             exchange: "NASDAQ", sector: "Communication Services" },
  { symbol: "AMD",     companyName: "Advanced Micro Devices",    exchange: "NASDAQ", sector: "Technology" },
  { symbol: "INTC",    companyName: "Intel Corporation",         exchange: "NASDAQ", sector: "Technology" },
  { symbol: "JPM",     companyName: "JPMorgan Chase & Co.",      exchange: "NYSE",   sector: "Financial Services" },
  { symbol: "V",       companyName: "Visa Inc.",                 exchange: "NYSE",   sector: "Financial Services" },
  { symbol: "WMT",     companyName: "Walmart Inc.",              exchange: "NYSE",   sector: "Consumer Defensive" },
  { symbol: "DIS",     companyName: "The Walt Disney Company",   exchange: "NYSE",   sector: "Communication Services" },
  { symbol: "PYPL",    companyName: "PayPal Holdings, Inc.",     exchange: "NASDAQ", sector: "Financial Services" },
  { symbol: "UBER",    companyName: "Uber Technologies, Inc.",   exchange: "NYSE",   sector: "Technology" },
  { symbol: "SPOT",    companyName: "Spotify Technology S.A.",   exchange: "NYSE",   sector: "Communication Services" },
];

/** Look up a stock by exact symbol (case-insensitive). */
export function findStock(symbol: string): StockInfo | undefined {
  return STOCK_UNIVERSE.find(
    (s) => s.symbol === symbol.trim().toUpperCase()
  );
}

/** Search the universe by symbol prefix or company name substring. */
export function searchUniverse(query: string, limit = 10): StockInfo[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  return STOCK_UNIVERSE.filter(
    (s) =>
      s.symbol.startsWith(q) ||
      s.companyName.toUpperCase().includes(q)
  ).slice(0, limit);
}
