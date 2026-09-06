import { NextRequest, NextResponse } from "next/server";
import { createWatchlist, getWatchlists } from "@/lib/watchlist-service";
import { getAuthSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session.userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const watchlists = await getWatchlists(session.userId);

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
    const session = await getAuthSession();
    if (!session.userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const name = body?.name;

    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName || trimmedName.length > 64) {
      return NextResponse.json(
        { error: "Watchlist name must be between 1 and 64 characters" },
        { status: 400 },
      );
    }

    const watchlist = await createWatchlist(session.userId, trimmedName);

    return NextResponse.json(watchlist, { status: 201 });
  } catch (error) {
    console.error("Failed to create watchlist:", error);

    return NextResponse.json(
      { error: "Failed to create watchlist" },
      { status: 500 },
    );
  }
}