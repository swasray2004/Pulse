import { getIronSession, SessionOptions, unsealData } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId?: string;
  email?: string;
  name?: string;
}

export const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_SECRET ||
    "pulse_super_secret_session_key_min_32_characters_long_2026_prod",
  cookieName: "pulse_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getAuthSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export { unsealData };
