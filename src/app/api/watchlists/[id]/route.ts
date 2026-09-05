import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { id } = await params;

    const watchlist = await prisma.watchlist.findUnique({
      where: { id },
      include: {
        stocks: {
          orderBy: { position: "asc" },
        },
      },
    });

    if (!watchlist) {
      return NextResponse.json(
        { error: "Watchlist not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(watchlist);
  } catch (error) {
    console.error("Failed to fetch watchlist:", error);

    return NextResponse.json(
      { error: "Failed to fetch watchlist" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 },
      );
    }

    const name = body.name.trim();

    if (!name) {
      return NextResponse.json(
        { error: "Watchlist name cannot be empty" },
        { status: 400 },
      );
    }

    const watchlist = await prisma.watchlist.update({
      where: { id },
      data: { name },
      include: {
        stocks: {
          orderBy: { position: "asc" },
        },
      },
    });

    return NextResponse.json(watchlist);
  } catch (error) {
    console.error("Failed to update watchlist:", error);

    return NextResponse.json(
      { error: "Failed to update watchlist" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { id } = await params;

    await prisma.watchlist.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete watchlist:", error);

    return NextResponse.json(
      { error: "Failed to delete watchlist" },
      { status: 500 },
    );
  }
}