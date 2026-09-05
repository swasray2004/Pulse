import type {
    AttentionClassification,
    AttentionResult,
    ChangeWindowInput,
    SignalBreakdown,
    UserPreferenceInput,
} from "./types";

import { DEFAULT_PREFERENCES } from "./types";
// ────────────────────────────────────────────────────────────────────────
// PULSE Attention Score
//
// The score is a weighted sum of five independent sub-signals, each capped
// so no single factor can dominate the score on its own (e.g. a huge price
// move on trivial volume shouldn't read as HIGH_ATTENTION). Personalization
// is applied last, as a bounded adjustment, not a multiplier — preferences
// should be able to shift what counts as noise, but not invent a signal
// that isn't there.
//
// price_signal              0–30   magnitude of the move, log-scaled
// volume_signal              0–20   how anomalous volume is vs. trailing avg
// relative_performance_signal 0–20  outperformance vs. benchmark AND sector
// event_signal                0–15  presence/type of a corroborating event
// volatility_signal           0–10  move size relative to the stock's own
//                                   normal volatility (a 3% move in a stock
//                                   that normally moves 0.5% matters more
//                                   than 3% in one that normally moves 4%)
// personalization_adjustment -10–10 shifts based on user's stated sensitivities
//
// Total is clamped to 0–100.
// ────────────────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}

function priceChangePct(from: number, to: number): number {
    if (from === 0) return 0;
    return ((to - from) / from) * 100;
}

function priceSignal(pctChange: number): number {
    // log-scaled so 1% -> ~9, 3% -> ~19, 7% -> ~27, 10%+ saturates near 30
    const magnitude = Math.abs(pctChange);
    const scaled = 30 * (Math.log(1 + magnitude) / Math.log(1 + 12));
    return clamp(scaled, 0, 30);
}

function volumeSignal(currentVolume: number, normalVolume: number): number {
    if (normalVolume <= 0) return 0;
    const ratio = currentVolume / normalVolume;
    if (ratio <= 1) return 0;
    // 1.5x -> ~8, 2x -> ~14, 3x -> ~20 (saturates), 4x+ stays at cap
    const scaled = 20 * (Math.log(ratio) / Math.log(4));
    return clamp(scaled, 0, 20);
}

function relativePerformanceSignal(
    stockPct: number,
    benchmarkPct: number,
    sectorPct: number
): number {
    const vsBenchmark = Math.abs(stockPct - benchmarkPct);
    const vsSector = Math.abs(stockPct - sectorPct);
    // weight benchmark divergence slightly more — it's the stronger "signal, not noise" tell
    const combined = vsBenchmark * 0.6 + vsSector * 0.4;
    const scaled = 20 * (Math.log(1 + combined) / Math.log(1 + 8));
    return clamp(scaled, 0, 20);
}

const EVENT_WEIGHTS: Record<string, number> = {
    earnings: 15,
    guidance: 13,
    analyst_action: 9,
    "52w_high": 8,
    "52w_low": 8,
    news: 6,
    other: 3,
};

function eventSignal(events: ChangeWindowInput["events"]): number {
    if (events.length === 0) return 0;
    const best = Math.max(...events.map((e) => EVENT_WEIGHTS[e.type] ?? 3));
    // more than one corroborating event nudges it up slightly
    const bonus = events.length > 1 ? 2 : 0;
    return clamp(best + bonus, 0, 15);
}

function volatilitySignal(pctChange: number, historicalVolatilityPct: number): number {
    const baseline = Math.max(historicalVolatilityPct, 0.25); // avoid divide-by-zero on quiet stocks
    const ratio = Math.abs(pctChange) / baseline;
    if (ratio <= 1) return 0;
    const scaled = 10 * (Math.log(ratio) / Math.log(5));
    return clamp(scaled, 0, 10);
}

function personalizationAdjustment(
    base: Omit<SignalBreakdown, "personalization">,
    prefs: UserPreferenceInput
): number {
    // Center each sensitivity on 0.5 (neutral). Above 0.5 amplifies that
    // sub-signal's contribution; below 0.5 dampens it. Bounded to +/-10 total
    // so personalization can re-rank near the boundary but never flips a
    // NORMAL move into HIGH_ATTENTION on preference alone.
    const priceAdj = (prefs.priceSensitivity - 0.5) * (base.price / 30) * 10;
    const volumeAdj = (prefs.volumeSensitivity - 0.5) * (base.volume / 20) * 8;
    const relAdj =
        (prefs.relativePerformanceSensitivity - 0.5) * (base.relativePerformance / 20) * 8;
    const eventAdj = (prefs.eventSensitivity - 0.5) * (base.event / 15) * 8;

    const total = priceAdj + volumeAdj + relAdj + eventAdj;
    return clamp(total, -10, 10);
}

function classify(score: number): AttentionClassification {
    if (score <= 30) return "NORMAL";
    if (score <= 60) return "INTERESTING";
    if (score <= 80) return "IMPORTANT";
    return "HIGH_ATTENTION";
}

function buildReason(input: ChangeWindowInput, signals: SignalBreakdown, pctChange: number): string {
    const parts: string[] = [];
    const dir = pctChange >= 0 ? "up" : "down";
    parts.push(`${input.symbol} is ${dir} ${Math.abs(pctChange).toFixed(1)}%`);

    if (signals.volume > 8) {
        const ratio = input.currentVolume / Math.max(input.normalVolume, 1);
        parts.push(`on ${ratio.toFixed(1)}x normal volume`);
    }
    if (signals.relativePerformance > 8) {
        const vsBench = pctChange - input.benchmarkChangePct;
        parts.push(
            `${vsBench >= 0 ? "outperforming" : "underperforming"} the market by ${Math.abs(vsBench).toFixed(1)}%`
        );
    }
    if (signals.event > 0 && input.events.length > 0) {
        parts.push(`with a ${input.events[0]!.type.replace("_", " ")} event detected`);
    }
    return parts.join(", ") + ".";
}

export function computeAttentionScore(
    input: ChangeWindowInput,
    preferences: UserPreferenceInput = DEFAULT_PREFERENCES
): AttentionResult {
    const pctChange = priceChangePct(input.priceFrom, input.priceTo);
    const volumeRatio = input.normalVolume > 0 ? input.currentVolume / input.normalVolume : 1;

    const base: Omit<SignalBreakdown, "personalization"> = {
        price: priceSignal(pctChange),
        volume: volumeSignal(input.currentVolume, input.normalVolume),
        relativePerformance: relativePerformanceSignal(
            pctChange,
            input.benchmarkChangePct,
            input.sectorChangePct
        ),
        event: eventSignal(input.events),
        volatility: volatilitySignal(pctChange, input.historicalVolatilityPct),
    };

    const personalization = personalizationAdjustment(base, preferences);
    const signals: SignalBreakdown = { ...base, personalization };

    const rawScore =
        base.price + base.volume + base.relativePerformance + base.event + base.volatility + personalization;
    const score = Math.round(clamp(rawScore, 0, 100));

    return {
        score,
        classification: classify(score),
        state: "NORMAL", // filled in by state-classifier.ts, kept separate on purpose
        reason: buildReason(input, signals, pctChange),
        signals,
        priceChangePct: pctChange,
        relativeToBenchmarkPct: pctChange - input.benchmarkChangePct,
        relativeToSectorPct: pctChange - input.sectorChangePct,
        volumeRatio,
    };
}
