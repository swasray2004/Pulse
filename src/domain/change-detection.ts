import { computeAttentionScore } from "./attention-score";
import { classifyState } from "./state-classifier";
import {
    AttentionResult,
    ChangeWindowInput,
    DEFAULT_PREFERENCES,
    StockState,
    UserPreferenceInput,
} from "./types";

export interface DetectedChangeOutput {
    symbol: string;
    companyName: string;
    attention: AttentionResult;
    state: StockState;
    windowStart: Date;
    windowEnd: Date;
}

export interface SignalNoiseSplit {
    signals: DetectedChangeOutput[]; // classification !== NORMAL
    noise: DetectedChangeOutput[]; // classification === NORMAL
    totalMovements: number;
}

const LONG_ABSENCE_DAYS = 3;

/**
 * The core "while you were away" comparison: for each watched stock, score
 * the change between the user's lastCheckedAt and now, then split the result
 * into signal vs. noise. This is intentionally the *only* place that decides
 * what counts as a movement worth deduplicating/aggregating — API routes and
 * UI just consume the output.
 */
export function detectChanges(
    inputs: ChangeWindowInput[],
    preferences: UserPreferenceInput = DEFAULT_PREFERENCES
): SignalNoiseSplit {
    const results: DetectedChangeOutput[] = inputs.map((input) => {
        const attention = computeAttentionScore(input, preferences);
        const state = classifyState(input, attention);
        return {
            symbol: input.symbol,
            companyName: input.companyName,
            attention,
            state,
            windowStart: input.windowStart,
            windowEnd: input.windowEnd,
        };
    });

    const signals = results
        .filter((r) => r.attention.classification !== "NORMAL")
        .sort((a, b) => b.attention.score - a.attention.score);
    const noise = results.filter((r) => r.attention.classification === "NORMAL");

    return { signals, noise, totalMovements: results.length };
}

export function isLongAbsence(lastCheckedAt: Date, now: Date = new Date()): boolean {
    const days = (now.getTime() - lastCheckedAt.getTime()) / (1000 * 60 * 60 * 24);
    return days >= LONG_ABSENCE_DAYS;
}

export interface AbsenceSummary {
    awayLabel: string; // e.g. "18 days" or "4h 37m"
    isLongAbsence: boolean;
    totalMovements: number;
    meaningfulCount: number;
    filteredCount: number;
    topSignals: DetectedChangeOutput[]; // capped for long absences
}

/**
 * Wraps detectChanges with the "long absence" rule from the spec: don't dump
 * hundreds of events on someone who's been away for weeks — aggregate to a
 * count and surface only the highest-scoring handful, with the rest
 * reachable but collapsed.
 */
export function summarizeAbsence(
    inputs: ChangeWindowInput[],
    lastCheckedAt: Date,
    preferences: UserPreferenceInput = DEFAULT_PREFERENCES,
    now: Date = new Date()
): AbsenceSummary {
    const split = detectChanges(inputs, preferences);
    const long = isLongAbsence(lastCheckedAt, now);

    const cap = long ? 8 : split.signals.length;
    const topSignals = split.signals.slice(0, cap);

    return {
        awayLabel: formatAway(lastCheckedAt, now),
        isLongAbsence: long,
        totalMovements: split.totalMovements,
        meaningfulCount: split.signals.length,
        filteredCount: split.noise.length,
        topSignals,
    };
}

export function formatAway(lastCheckedAt: Date, now: Date = new Date()): string {
    const ms = Math.max(0, now.getTime() - lastCheckedAt.getTime());
    const totalMinutes = Math.floor(ms / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    if (days >= 1) return `${days} day${days === 1 ? "" : "s"}`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours >= 1) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

/**
 * Duplicate event handling: two provider feeds (or a retry) can report the
 * same underlying event twice. Dedupe by (symbol, type, headline) within a
 * short time bucket rather than by exact timestamp, since providers rarely
 * agree on the millisecond.
 */
export function dedupeEvents<T extends { symbol: string; type: string; headline: string; timestamp: Date }>(
    events: T[],
    bucketMinutes = 10
): T[] {
    const seen = new Map<string, T>();
    for (const event of events) {
        const bucket = Math.floor(event.timestamp.getTime() / (bucketMinutes * 60000));
        const key = `${event.symbol}|${event.type}|${event.headline.trim().toLowerCase()}|${bucket}`;
        if (!seen.has(key)) seen.set(key, event);
    }
    return Array.from(seen.values());
}
