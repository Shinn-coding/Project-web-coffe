import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

/** GET /api/admin/session — current admin or 401 */
export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const { session } = guard;
  return NextResponse.json({
    success: true,
    user: { id: session.userId, username: session.username, name: session.name, role: session.role },
  });
}