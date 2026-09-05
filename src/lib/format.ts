export function formatPct(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

/**
 * formatPrice(symbol, price)
 * symbol is used to pick currency prefix (₹ for TCS/Indian stocks, $ otherwise).
 */
export function formatPrice(symbol: string, price: number): string {
  const indianSymbols = new Set(["TCS", "INFY", "WIPRO", "RELIANCE", "HDFCBANK"]);
  const currency = indianSymbols.has(symbol.toUpperCase()) ? "₹" : "$";
  return `${currency}${price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const STATE_LABELS: Record<string, string> = {
  EVENT_DRIVEN: "Event Driven",
  MARKET_MOVING: "Market Moving",
  BREAKOUT: "Breakout",
  UNUSUAL_ACTIVITY: "Unusual Activity",
  OUTPERFORMING: "Outperforming",
  UNDERPERFORMING: "Underperforming",
  NORMAL: "Normal",
};

export function stateLabel(state: string): string {
  return STATE_LABELS[state] ?? state.replace(/_/g, " ");
}
