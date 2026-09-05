// Pure domain types. No framework, no ORM, no I/O — this file (and its siblings
// in src/domain) should be importable in a plain Node script or a test runner
// with zero setup. That's deliberate: the scoring logic is the product's core
// IP and it needs to be independently testable and swappable.

export interface PriceObservation {
    symbol: string;
    price: number;
    volume: number;
    source: string;
    reliability: number; // 0..1
    timestamp: Date;
    receivedAt: Date;
}

export interface ResolvedObservation {
    symbol: string;
    price: number;
    volume: number;
    timestamp: Date;
    freshness: "LIVE" | "DELAYED" | "STALE";
    ageSeconds: number;
    usedSource: string;
    discrepancy?: {
        detected: true;
        candidates: { source: string; price: number }[];
        maxDeltaPct: number;
    };
}

export interface MarketEventInput {
    symbol: string;
    type:
    | "earnings"
    | "news"
    | "guidance"
    | "52w_high"
    | "52w_low"
    | "analyst_action"
    | "other";
    headline: string;
    timestamp: Date;
}

export interface UserPreferenceInput {
    priceSensitivity: number; // 0..1
    volumeSensitivity: number;
    newsSensitivity: number;
    eventSensitivity: number;
    relativePerformanceSensitivity: number;
    breakoutSensitivity: number;
}

export const DEFAULT_PREFERENCES: UserPreferenceInput = {
    priceSensitivity: 0.5,
    volumeSensitivity: 0.5,
    newsSensitivity: 0.5,
    eventSensitivity: 0.7,
    relativePerformanceSensitivity: 0.5,
    breakoutSensitivity: 0.5,
};

export interface ChangeWindowInput {
    symbol: string;
    companyName: string;
    sector: string;

    priceFrom: number;
    priceTo: number;

    normalVolume: number; // trailing average, e.g. 20-day
    currentVolume: number;

    benchmarkChangePct: number; // e.g. NASDAQ move over the same window
    sectorChangePct: number;

    fiftyTwoWeekHigh: number;
    fiftyTwoWeekLow: number;

    historicalVolatilityPct: number; // trailing daily stdev, as a percentage
    events: MarketEventInput[];

    windowStart: Date;
    windowEnd: Date;
}

export type StockState =
    | "NORMAL"
    | "QUIET"
    | "BREAKOUT"
    | "UNUSUAL_ACTIVITY"
    | "EVENT_DRIVEN"
    | "OUTPERFORMING"
    | "UNDERPERFORMING"
    | "MARKET_MOVING";

export type AttentionClassification =
    | "NORMAL"
    | "INTERESTING"
    | "IMPORTANT"
    | "HIGH_ATTENTION";

export interface SignalBreakdown {
    price: number; // 0..30
    volume: number; // 0..20
    relativePerformance: number; // 0..20
    event: number; // 0..15
    volatility: number; // 0..10
    personalization: number; // -10..10 (adjustment, can be negative)
}

export interface AttentionResult {
    score: number; // 0..100
    classification: AttentionClassification;
    state: StockState;
    reason: string;
    signals: SignalBreakdown;
    priceChangePct: number;
    relativeToBenchmarkPct: number;
    relativeToSectorPct: number;
    volumeRatio: number;
}
