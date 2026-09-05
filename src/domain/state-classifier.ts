import type {
    AttentionResult,
    ChangeWindowInput,
    StockState,
} from "./types";

// Deliberately a separate, small module from attention-score.ts:
// the score answers "how much should I care",
// while state answers "what kind of thing is this".
//
// Keeping them separate means either can change without touching
// the other, and the UI can show state even for a NORMAL-scored
// stock (for example, QUIET).

export function classifyState(
    input: ChangeWindowInput,
    result: AttentionResult
): StockState {
    const { signals, priceChangePct, volumeRatio } = result;

    const hasEvent = input.events.length > 0;

    const nearHigh = input.priceTo >= input.fiftyTwoWeekHigh * 0.98;
    const nearLow = input.priceTo <= input.fiftyTwoWeekLow * 1.02;

    const isBreakoutLevel = nearHigh && priceChangePct > 0;

    // 1. Event-driven:
    // A significant price move + unusual volume + a market event.
    if (signals.price > 15 && signals.volume > 10 && hasEvent) {
        return "EVENT_DRIVEN";
    }

    // 2. Breakout:
    // Price is approaching/crossing the 52-week high with meaningful upside.
    if (isBreakoutLevel && priceChangePct > 1.5) {
        return "BREAKOUT";
    }

    // 3. Unusual activity:
    // Volume is unusually high without a corresponding price movement.
    if (volumeRatio >= 2 && Math.abs(priceChangePct) < 1.5) {
        return "UNUSUAL_ACTIVITY";
    }

    // 4. Outperforming:
    // Stock is materially ahead of its benchmark.
    if (result.relativeToBenchmarkPct > 2 && priceChangePct > 0.5) {
        return "OUTPERFORMING";
    }

    // 5. Underperforming:
    // Stock is materially behind its benchmark.
    if (result.relativeToBenchmarkPct < -2 && priceChangePct < -0.5) {
        return "UNDERPERFORMING";
    }

    // 6. Market-moving:
    // Stock is moving, but almost exactly with the benchmark.
    if (
        Math.abs(priceChangePct - input.benchmarkChangePct) < 0.4 &&
        Math.abs(priceChangePct) > 0.5
    ) {
        return "MARKET_MOVING";
    }

    // A stock approaching its 52-week low on a meaningful decline.
    if (nearLow && priceChangePct < -1.5) {
        return "UNDERPERFORMING";
    }

    // 7. Quiet:
    // Very little price movement and below-normal/normal volume.
    if (Math.abs(priceChangePct) < 0.3 && volumeRatio < 1.2) {
        return "QUIET";
    }

    return "NORMAL";
}