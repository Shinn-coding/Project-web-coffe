import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// S2: in-memory failed-attempt limiter, 5 fails / 15 min per IP.
// ponytail: single-process only; per-IP Map in prod needs Redis/DB when multiple instances.
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const FAIL_DELAY_MS = 500;
const fails = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

function isBlocked(ip: string): boolean {
  const entry = fails.get(ip);
  if (!entry) return false;
  if (Date.now() >= entry.resetAt) {
    fails.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILS;
}

function recordFail(ip: string): void {
  const now = Date.now();
  const entry = fails.get(ip);
  if (!entry || now >= entry.resetAt) {
    fails.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
  fails.set(ip, entry);
}

export async function POST(request: NextRequest) {
  const ip = clientKey(request);

  if (isBlocked(ip)) {
    return Response.json(
      { success: false, error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." },
      { status: 429 }
    );
  }

  const session = await getSession();
  if (!session) {
    return Response.json({ success: false, error: "Tidak terautentikasi" }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string; confirmPassword?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Body tidak valid" }, { status: 400 });
  }

  const { currentPassword = "", newPassword = "", confirmPassword = "" } = body;

  if (newPassword.length < 8) {
    return Response.json({ success: false, error: "Password baru minimal 8 karakter" }, { status: 400 });
  }

  if (newPassword !== confirmPassword) {
    return Response.json({ success: false, error: "Konfirmasi password tidak sesuai" }, { status: 400 });
  }

  const admin = await prisma.adminUser.findUnique({ where: { id: session.userId } });
  if (!admin) {
    return Response.json({ success: false, error: "Tidak terautentikasi" }, { status: 401 });
  }

  const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
  if (!valid) {
    recordFail(ip);
    await new Promise((resolve) => setTimeout(resolve, FAIL_DELAY_MS));
    return Response.json({ success: false, error: "Password lama salah" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { passwordHash },
  });

  return Response.json({ success: true, message: "Password berhasil diubah" });
}