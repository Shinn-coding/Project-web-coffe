import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken, sessionCookieOptions, COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

// S2: in-memory failed-attempt limiter, 5 fails / 15 min per IP.
// ponytail: single-process only; per-IP Map in prod needs Redis/DB when multiple instances.
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const FAIL_DELAY_MS = 500; // fixed sleep on failure — constant-time-ish defense
const fails = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

function isBlocked(ip: string): boolean {
  const entry = fails.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    fails.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILS;
}

function recordFail(ip: string) {
  const now = Date.now();
  const entry = fails.get(ip);
  if (!entry || now > entry.resetAt) {
    fails.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

/** POST /api/admin/login */
export async function POST(req: NextRequest) {
  const ip = clientKey(req);
  if (isBlocked(ip)) {
    return NextResponse.json(
      { success: false, error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." },
      { status: 429 }
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Body tidak valid" }, { status: 400 });
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  if (!username || !password) {
    return NextResponse.json({ success: false, error: "Username dan password wajib diisi" }, { status: 400 });
  }

  const user = await prisma.adminUser.findUnique({ where: { username } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    recordFail(ip);
    await new Promise((r) => setTimeout(r, FAIL_DELAY_MS)); // constant-time-ish failure delay
    return NextResponse.json({ success: false, error: "Username atau password salah" }, { status: 401 });
  }

  const token = createSessionToken({ userId: user.id, username: user.username, name: user.name, role: user.role });

  const response = NextResponse.json({
    success: true,
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  });
  response.cookies.set(COOKIE_NAME, token, sessionCookieOptions());
  return response;
}