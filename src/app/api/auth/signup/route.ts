import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, hashPassword } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const rl = checkRateLimit(`signup:${ip}`, { limit: 5, windowMs: 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many accounts created from this IP. Please wait a minute." },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) },
        },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { name, email, password, confirmPassword } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 },
      );
    }

    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = email.trim().toLowerCase();
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { error: "Please provide a valid email address" },
        { status: 400 },
      );
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 },
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match" },
        { status: 400 },
      );
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        preference: {
          create: {
            priceSensitivity: 0.5,
            volumeSensitivity: 0.5,
            newsSensitivity: 0.5,
            eventSensitivity: 0.7,
            relativePerformanceSensitivity: 0.5,
            breakoutSensitivity: 0.5,
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    const session = await getAuthSession();
    session.userId = user.id;
    session.email = user.email;
    session.name = user.name ?? undefined;
    await session.save();

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Failed to create account. Please try again." },
      { status: 500 },
    );
  }
}
