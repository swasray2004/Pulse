import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

const DEFAULT_PREFERENCES = {
    priceSensitivity: 0.5,
    volumeSensitivity: 0.5,
    newsSensitivity: 0.5,
    eventSensitivity: 0.7,
    relativePerformanceSensitivity: 0.5,
    breakoutSensitivity: 0.5,
};

/**
 * GET /api/preferences
 * Returns the user preference values for the authenticated user.
 * Auto-creates a row with defaults on first call.
 */
export async function GET() {
    try {
        const session = await getAuthSession();
        if (!session.userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const userId = session.userId;

        const pref = await prisma.userPreference.upsert({
            where: { userId },
            create: {
                userId,
                ...DEFAULT_PREFERENCES,
            },
            update: {},
        });

        return NextResponse.json({
            preferences: {
                priceSensitivity: pref.priceSensitivity,
                volumeSensitivity: pref.volumeSensitivity,
                newsSensitivity: pref.newsSensitivity,
                eventSensitivity: pref.eventSensitivity,
                relativePerformanceSensitivity: pref.relativePerformanceSensitivity,
                breakoutSensitivity: pref.breakoutSensitivity,
            },
        });
    } catch (error) {
        console.error("Failed to fetch preferences:", error);
        return NextResponse.json(
            { error: "Failed to fetch preferences" },
            { status: 500 },
        );
    }
}

/**
 * PATCH /api/preferences
 * Body: { [key: string]: number }
 * Partially updates preference values for the authenticated user.
 */
export async function PATCH(request: NextRequest) {
    try {
        const session = await getAuthSession();
        if (!session.userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const userId = session.userId;
        const body = await request.json();

        const allowedKeys = [
            "priceSensitivity",
            "volumeSensitivity",
            "newsSensitivity",
            "eventSensitivity",
            "relativePerformanceSensitivity",
            "breakoutSensitivity",
        ] as const;

        type PrefKey = typeof allowedKeys[number];

        const updates: Partial<Record<PrefKey, number>> = {};

        for (const key of allowedKeys) {
            if (key in body && typeof body[key] === "number") {
                const val = body[key] as number;
                // Clamp to 0..1
                updates[key] = Math.min(1, Math.max(0, val));
            }
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json(
                { error: "No valid preference fields provided" },
                { status: 400 },
            );
        }

        const pref = await prisma.userPreference.upsert({
            where: { userId },
            create: {
                userId,
                ...DEFAULT_PREFERENCES,
                ...updates,
            },
            update: updates,
        });

        return NextResponse.json({
            preferences: {
                priceSensitivity: pref.priceSensitivity,
                volumeSensitivity: pref.volumeSensitivity,
                newsSensitivity: pref.newsSensitivity,
                eventSensitivity: pref.eventSensitivity,
                relativePerformanceSensitivity: pref.relativePerformanceSensitivity,
                breakoutSensitivity: pref.breakoutSensitivity,
            },
        });
    } catch (error) {
        console.error("Failed to update preferences:", error);
        return NextResponse.json(
            { error: "Failed to update preferences" },
            { status: 500 },
        );
    }
}
