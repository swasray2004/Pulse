import { describe, expect, it } from "vitest";
import { dedupeEvents, isLongAbsence, summarizeAbsence } from "../src/domain/change-detection";
import { resolveObservation, formatFreshness } from "../src/domain/market-data-resolver";
import { ChangeWindowInput } from "../src/domain/types";

function change(overrides: Partial<ChangeWindowInput> = {}): ChangeWindowInput {
    return {
        symbol: "AAA",
        companyName: "Company A",
        sector: "Tech",
        priceFrom: 100,
        priceTo: 100.1,
        normalVolume: 1_000_000,
        currentVolume: 1_010_000,
        benchmarkChangePct: 0.1,
        sectorChangePct: 0.1,
        fiftyTwoWeekHigh: 140,
        fiftyTwoWeekLow: 70,
        historicalVolatilityPct: 1,
        events: [],
        windowStart: new Date("2026-09-04T10:42:00Z"),
        windowEnd: new Date("2026-09-04T15:19:00Z"),
        ...overrides,
    };
}

describe("summarizeAbsence", () => {
    it("splits signal from noise and reports counts (spec example: 23 -> 4 signals / 19 filtered)", () => {
        const inputs: ChangeWindowInput[] = [
            ...Array.from({ length: 19 }, (_, i) => change({ symbol: `NOISE${i}` })),
            change({ symbol: "NVDA", priceFrom: 175, priceTo: 186.9, currentVolume: 56_000_000, normalVolume: 20_000_000, benchmarkChangePct: 1.9, sectorChangePct: 3.2, events: [{ symbol: "NVDA", type: "earnings", headline: "beat", timestamp: new Date() }] }),
            change({ symbol: "TSLA", priceFrom: 250, priceTo: 244, currentVolume: 40_000_000, normalVolume: 25_000_000, benchmarkChangePct: 0.2, sectorChangePct: -0.5 }),
            change({ symbol: "TCS", priceFrom: 3900, priceTo: 4009, currentVolume: 5_000_000, normalVolume: 2_500_000, benchmarkChangePct: 0.3 }),
            change({ symbol: "MSFT", priceFrom: 420, priceTo: 424, currentVolume: 20_000_000, normalVolume: 18_000_000, benchmarkChangePct: 0.4 }),
        ];
        const lastCheckedAt = new Date("2026-09-04T10:42:00Z");
        const now = new Date("2026-09-04T15:19:00Z");
        const summary = summarizeAbsence(inputs, lastCheckedAt, undefined, now);

        expect(summary.totalMovements).toBe(23);
        expect(summary.awayLabel).toBe("4h 37m");
        expect(summary.filteredCount).toBeGreaterThan(0);
        expect(summary.meaningfulCount + summary.filteredCount).toBe(23);
        expect(summary.isLongAbsence).toBe(false);
    });

    it("caps and aggregates signals for a long absence instead of dumping every event", () => {
        const inputs = Array.from({ length: 30 }, (_, i) =>
            change({
                symbol: `SYM${i}`,
                priceFrom: 100,
                priceTo: 100 + (i % 10),
                currentVolume: 5_000_000,
                normalVolume: 1_000_000,
                benchmarkChangePct: 0.1,
            })
        );
        const lastCheckedAt = new Date("2026-08-17T00:00:00Z");
        const now = new Date("2026-09-04T00:00:00Z"); // 18 days
        const summary = summarizeAbsence(inputs, lastCheckedAt, undefined, now);

        expect(summary.isLongAbsence).toBe(true);
        expect(summary.awayLabel).toBe("18 days");
        expect(summary.topSignals.length).toBeLessThanOrEqual(8);
    });
});

describe("isLongAbsence / formatAway", () => {
    it("treats 3+ days as a long absence", () => {
        expect(isLongAbsence(new Date("2026-09-01T00:00:00Z"), new Date("2026-09-04T00:01:00Z"))).toBe(true);
        expect(isLongAbsence(new Date("2026-09-03T00:00:00Z"), new Date("2026-09-04T00:01:00Z"))).toBe(false);
    });
});

describe("dedupeEvents", () => {
    it("collapses the same event reported twice within a short window", () => {
        const events = [
            { symbol: "NVDA", type: "earnings", headline: "Beats estimates", timestamp: new Date("2026-09-04T12:03:00Z") },
            { symbol: "NVDA", type: "earnings", headline: "Beats estimates", timestamp: new Date("2026-09-04T12:04:30Z") },
            { symbol: "NVDA", type: "news", headline: "Analyst raises target", timestamp: new Date("2026-09-04T13:00:00Z") },
        ];
        expect(dedupeEvents(events)).toHaveLength(2);
    });
});

describe("resolveObservation (conflicting / stale data)", () => {
    it("prefers the more reliable, more recent source", () => {
        const now = new Date("2026-09-04T15:00:10Z");
        const resolved = resolveObservation(
            [
                { symbol: "AAA", price: 183.42, volume: 1_000_000, source: "provider-a", reliability: 0.95, timestamp: now, receivedAt: new Date("2026-09-04T15:00:08Z") },
                { symbol: "AAA", price: 183.39, volume: 1_000_000, source: "provider-b", reliability: 0.8, timestamp: now, receivedAt: new Date("2026-09-04T15:00:09Z") },
            ],
            now
        );
        expect(resolved?.usedSource).toBe("provider-a");
        expect(resolved?.freshness).toBe("LIVE");
    });

    it("flags a discrepancy when candidates diverge meaningfully", () => {
        const now = new Date("2026-09-04T15:00:10Z");
        const resolved = resolveObservation(
            [
                { symbol: "AAA", price: 100, volume: 1_000_000, source: "provider-a", reliability: 0.9, timestamp: now, receivedAt: now },
                { symbol: "AAA", price: 103, volume: 1_000_000, source: "provider-b", reliability: 0.85, timestamp: now, receivedAt: now },
            ],
            now
        );
        expect(resolved?.discrepancy?.detected).toBe(true);
    });

    it("marks old data as STALE and formats a human label", () => {
        const now = new Date("2026-09-04T17:00:00Z");
        const resolved = resolveObservation(
            [{ symbol: "AAA", price: 100, volume: 1, source: "provider-a", reliability: 0.9, timestamp: now, receivedAt: new Date("2026-09-04T15:00:00Z") }],
            now
        )!;
        expect(resolved.freshness).toBe("STALE");
        expect(formatFreshness(resolved)).toMatch(/Stale/);
    });

    it("returns null when there are no observations at all (provider fully unavailable)", () => {
        expect(resolveObservation([])).toBeNull();
    });
});
