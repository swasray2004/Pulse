import { prisma } from "@/lib/prisma";

export async function getWatchlists(userId: string) {
  return prisma.watchlist.findMany({
    where: { userId },
    include: {
      stocks: {
        orderBy: { position: "asc" },
      },
    },
    orderBy: { position: "asc" },
  });
}

export async function createWatchlist(
  userId: string,
  name: string,
) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("Watchlist name cannot be empty");
  }

  return prisma.watchlist.create({
    data: {
      userId,
      name: trimmedName,
    },
    include: {
      stocks: true,
    },
  });
}