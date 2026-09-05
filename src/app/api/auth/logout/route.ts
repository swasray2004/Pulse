import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";

export async function POST() {
  try {
    const session = await getAuthSession();
    session.destroy();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Failed to log out" },
      { status: 500 },
    );
  }
}
