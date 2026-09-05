import { NextRequest, NextResponse } from "next/server";
import {
  createWatchlist,
  getWatchlists,
} from "@/lib/watchlist-service";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    const watchlists = await getWatchlists(userId);

    return NextResponse.json(watchlists);
  } catch (error) {
    console.error("Failed to fetch watchlists:", error);

    return NextResponse.json(
      { error: "Failed to fetch watchlists" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const userId = body.userId;
    const name = body.name;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 },
      );
    }

    const watchlist = await createWatchlist(userId, name);

    return NextResponse.json(watchlist, { status: 201 });
  } catch (error) {
    console.error("Failed to create watchlist:", error);

    return NextResponse.json(
      { error: "Failed to create watchlist" },
      { status: 500 },
    );
  }
}