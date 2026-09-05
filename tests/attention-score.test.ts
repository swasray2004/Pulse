import { describe, expect, it } from "vitest";
import { computeAttentionScore } from "../src/domain/attention-score";
import { classifyState } from "../src/domain/state-classifier";
import { ChangeWindowInput, DEFAULT_PREFERENCES } from "../src/domain/types";

function baseInput(overrides: Partial<ChangeWindowInput> = {}): ChangeWindowInput {
    return {
        symbol: "TEST",
        companyName: "Test Co",
        sector: "Technology",
        priceFrom: 100,
        priceTo: 100.2,
        normalVolume: 1_000_000,
        currentVolume: 1_050_000,
        benchmarkChangePct: 0.2,
        sectorChangePct: 0.2,
        fiftyTwoWeekHigh: 150,
        fiftyTwoWeekLow: 80,
        historicalVolatilityPct: 1.2,
        events: [],
        windowStart: new Date("2026-09-04T10:42:00Z"),
        windowEnd: new Date("2026-09-04T15:19:00Z"),
        ...overrides,
    };
}

describe("computeAttentionScore", () => {
    it("scores a quiet, market-tracking move as NORMAL", () => {
        const result = computeAttentionScore(baseInput());
        expect(result.classification).toBe("NORMAL");
        expect(result.score).toBeLessThanOrEqual(30);
    });

    it("scores a high-significance move (per spec example) as IMPORTANT or higher", () => {
        // previous=100, current=106, normal vol=1M, current vol=3M, benchmark=+1%
        const result = computeAttentionScore(
            baseInput({
                priceFrom: 100,
                priceTo: 106,
                normalVolume: 1_000_000,
                currentVolume: 3_000_000,
                benchmarkChangePct: 1,
                sectorChangePct: 1.5,
            })
        );
        expect(result.score).toBeGreaterThan(60);
        expect(["IMPORTANT", "HIGH_ATTENTION"]).toContain(result.classification);
    });

    it("pushes an earnings-driven outlier into HIGH_ATTENTION", () => {
        const result = computeAttentionScore(
            baseInput({
                priceFrom: 175,
                priceTo: 186.9, // +6.8%
                normalVolume: 20_000_000,
                currentVolume: 56_000_000, // 2.8x
                benchmarkChangePct: 1.9,
                sectorChangePct: 3.2,
                events: [{ symbol: "TEST", type: "earnings", headline: "Beats estimates", timestamp: new Date() }],
            })
        );
        expect(result.classification).toBe("HIGH_ATTENTION");
        expect(result.signals.event).toBeGreaterThan(0);
    });

    it("never produces a score outside 0..100", () => {
        const extreme = computeAttentionScore(
            baseInput({
                priceFrom: 10,
                priceTo: 40,
                currentVolume: 100_000_000,
                normalVolume: 100_000,
                benchmarkChangePct: -5,
                sectorChangePct: -5,
                events: [
                    { symbol: "TEST", type: "earnings", headline: "a", timestamp: new Date() },
                    { symbol: "TEST", type: "guidance", headline: "b", timestamp: new Date() },
                ],
            })
        );
        expect(extreme.score).toBeGreaterThanOrEqual(0);
        expect(extreme.score).toBeLessThanOrEqual(100);
    });

    it("personalization shifts the score but cannot flip NORMAL into HIGH_ATTENTION alone", () => {
        const input = baseInput();
        const low = computeAttentionScore(input, {
            ...DEFAULT_PREFERENCES,
            priceSensitivity: 0,
            volumeSensitivity: 0,
            eventSensitivity: 0,
            relativePerformanceSensitivity: 0,
        });
        const high = computeAttentionScore(input, {
            ...DEFAULT_PREFERENCES,
            priceSensitivity: 1,
            volumeSensitivity: 1,
            eventSensitivity: 1,
            relativePerformanceSensitivity: 1,
        });
        expect(high.score).toBeGreaterThanOrEqual(low.score);
        expect(high.classification).not.toBe("HIGH_ATTENTION");
    });
});

describe("classifyState", () => {
    it("flags EVENT_DRIVEN when price + volume + event all line up", () => {
        const input = baseInput({
            priceFrom: 175,
            priceTo: 186.9,
            normalVolume: 20_000_000,
            currentVolume: 56_000_000,
            benchmarkChangePct: 1.9,
            sectorChangePct: 3.2,
            events: [{ symbol: "TEST", type: "earnings", headline: "Beats estimates", timestamp: new Date() }],
        });
        const attention = computeAttentionScore(input);
        expect(classifyState(input, attention)).toBe("EVENT_DRIVEN");
    });

    it("flags MARKET_MOVING when a stock just tracks the benchmark", () => {
        const input = baseInput({ priceFrom: 100, priceTo: 101.8, benchmarkChangePct: 1.8, sectorChangePct: 1.7 });
        const attention = computeAttentionScore(input);
        expect(classifyState(input, attention)).toBe("MARKET_MOVING");
    });

    it("flags QUIET for near-zero movement and volume", () => {
        const input = baseInput({ priceFrom: 100, priceTo: 100.05, currentVolume: 900_000 });
        const attention = computeAttentionScore(input);
        expect(classifyState(input, attention)).toBe("QUIET");
    });
});
