import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, verifyPassword } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const rl = checkRateLimit(`login:${ip}`, { limit: 10, windowMs: 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many login attempts. Please wait a minute and try again." },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) },
        },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { email, password } = body;

    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const session = await getAuthSession();
    session.userId = user.id;
    session.email = user.email;
    session.name = user.name ?? undefined;
    await session.save();

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Authentication failed. Please try again." },
      { status: 500 },
    );
  }
}
