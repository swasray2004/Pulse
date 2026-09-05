import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "./session";

export * from "./session";

export async function getCurrentUser() {
  const session = await getAuthSession();
  if (!session.userId) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });
    return user;
  } catch (error) {
    console.error("Failed to fetch current user:", error);
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
