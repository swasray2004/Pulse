import { PriceObservation, ResolvedObservation } from "./types";

// Treats every market observation as unreliable external input (see product
// spec §16-17). Never trust a single provider's number blindly; resolve a
// single "best current view" per symbol and remember why we chose it.

const LIVE_THRESHOLD_SECONDS = 30;
const DELAYED_THRESHOLD_SECONDS = 15 * 60;

// Discrepancies above this are surfaced in the UI rather than silently resolved.
const MEANINGFUL_DISCREPANCY_PCT = 0.15;

function freshnessFor(ageSeconds: number): ResolvedObservation["freshness"] {
    if (ageSeconds <= LIVE_THRESHOLD_SECONDS) return "LIVE";
    if (ageSeconds <= DELAYED_THRESHOLD_SECONDS) return "DELAYED";
    return "STALE";
}

/**
 * Resolves the "best" observation for a symbol out of one or more provider
 * observations covering (roughly) the same instant.
 *
 * Ranking: reliability first, then recency (freshest receivedAt wins ties),
 * then availability (a provider that responded beats one that didn't, which
 * is handled by simply not including it in `observations`).
 */
export function resolveObservation(
    observations: PriceObservation[],
    now: Date = new Date()
): ResolvedObservation | null {
    if (observations.length === 0) return null;

    const ranked = [...observations].sort((a, b) => {
        if (b.reliability !== a.reliability) return b.reliability - a.reliability;
        return b.receivedAt.getTime() - a.receivedAt.getTime();
    });

    const chosen = ranked[0]!;
    const ageSeconds = Math.max(0, (now.getTime() - chosen.receivedAt.getTime()) / 1000);

    const result: ResolvedObservation = {
        symbol: chosen.symbol,
        price: chosen.price,
        volume: chosen.volume,
        timestamp: chosen.timestamp,
        freshness: freshnessFor(ageSeconds),
        ageSeconds,
        usedSource: chosen.source,
    };

    if (observations.length > 1) {
        const prices = observations.map((o) => o.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const maxDeltaPct = min > 0 ? ((max - min) / min) * 100 : 0;

        if (maxDeltaPct >= MEANINGFUL_DISCREPANCY_PCT) {
            result.discrepancy = {
                detected: true,
                candidates: observations.map((o) => ({ source: o.source, price: o.price })),
                maxDeltaPct,
            };
        }
    }

    return result;
}

/** Human-readable freshness label for the UI, e.g. "Updated 8 seconds ago". */
export function formatFreshness(resolved: ResolvedObservation): string {
    const s = Math.round(resolved.ageSeconds);
    if (resolved.freshness === "LIVE") return `Updated ${s}s ago`;
    if (resolved.freshness === "DELAYED") {
        const m = Math.round(s / 60);
        return `Delayed — updated ${m}m ago`;
    }
    const h = Math.round(s / 3600);
    return h >= 1 ? `Stale — last known value from ${h}h ago` : `Stale — last known value from ${Math.round(s / 60)}m ago`;
}
