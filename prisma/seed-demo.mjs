/**
 * Demo seed — plain ESM Node script.
 * Uses the Prisma 7 generated client.
 */

import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const db = new PrismaClient({ adapter });

const now = new Date();
const h = (hours) => new Date(now.getTime() - hours * 60 * 60 * 1000);

const PAIRS = [
  { symbol: "AAPL", prev: { price: 182.5, volume: 58_000_000, ts: h(4) }, curr: { price: 189.3, volume: 93_000_000, ts: h(1) } },
  { symbol: "NVDA", prev: { price: 875.0, volume: 42_000_000, ts: h(5) }, curr: { price: 921.5, volume: 88_000_000, ts: h(1.5) } },
  { symbol: "TSLA", prev: { price: 248.0, volume: 95_000_000, ts: h(4.5) }, curr: { price: 229.6, volume: 72_000_000, ts: h(1.2) } },
  { symbol: "MSFT", prev: { price: 415.2, volume: 22_000_000, ts: h(4) }, curr: { price: 416.8, volume: 24_000_000, ts: h(1) } },
  { symbol: "AMZN", prev: { price: 194.0, volume: 35_000_000, ts: h(4) }, curr: { price: 199.5, volume: 41_000_000, ts: h(1) } },
  { symbol: "META", prev: { price: 563.0, volume: 14_000_000, ts: h(4) }, curr: { price: 581.0, volume: 28_000_000, ts: h(1) } },
  { symbol: "GOOGL", prev: { price: 178.5, volume: 25_000_000, ts: h(4) }, curr: { price: 180.1, volume: 26_000_000, ts: h(1) } },
  { symbol: "TCS", prev: { price: 3850.0, volume: 1_200_000, ts: h(4) }, curr: { price: 3950.0, volume: 1_800_000, ts: h(1) } },
];

const EVENTS = [
  { symbol: "NVDA", type: "earnings", headline: "NVDA Q2 revenue beats estimates by 12%; data-center segment surges", ts: h(2) },
  { symbol: "TSLA", type: "news", headline: "Tesla recalls 125k vehicles over software-defined braking issue", ts: h(3) },
  { symbol: "AAPL", type: "analyst_action", headline: "Morgan Stanley raises AAPL price target to $215 citing services growth", ts: h(2.5) },
];

async function main() {
  console.log("?? Demo seed starting…\n");

  for (const { symbol, prev, curr } of PAIRS) {
    const count = await db.marketSnapshot.count({ where: { symbol } });

    if (count >= 2) {
      console.log(`  ??  ${symbol}: already has ${count} snapshot(s) — skipping`);
      continue;
    }

    await db.marketSnapshot.create({
      data: {
        symbol,
        price: prev.price,
        volume: prev.volume,
        source: "demo",
        reliability: 0.9,
        timestamp: prev.ts,
      },
    });

    await db.marketSnapshot.create({
      data: {
        symbol,
        price: curr.price,
        volume: curr.volume,
        source: "demo",
        reliability: 0.9,
        timestamp: curr.ts,
      },
    });

    const pct = (((curr.price - prev.price) / prev.price) * 100).toFixed(1);
    console.log(`  ? ${symbol}: 2 snapshots seeded (${pct > 0 ? "+" : ""}${pct}%)`);
  }

  console.log("\n  Seeding market events…");

  for (const { symbol, type, headline, ts } of EVENTS) {
    const existing = await db.marketEvent.findFirst({
      where: { symbol, type },
    });

    if (existing) {
      console.log(`  ??  Event ${symbol}/${type} already exists`);
      continue;
    }

    await db.marketEvent.create({
      data: {
        symbol,
        type,
        headline,
        timestamp: ts,
      },
    });

    console.log(`  ? Event: [${symbol}] ${headline.slice(0, 55)}…`);
  }

  const totalSnaps = await db.marketSnapshot.count();
  const totalEvents = await db.marketEvent.count();

  console.log(`\n? Seed complete. DB: ${totalSnaps} snapshots, ${totalEvents} events.`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
