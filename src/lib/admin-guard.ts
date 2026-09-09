import { NextResponse } from "next/server";
import { getSession, type AdminSession } from "@/lib/auth";

/**
 * Admin API guard. Returns a 401 NextResponse + null session, or the session
 * when the caller is an authenticated admin.
 */
export async function requireAdmin(): Promise<{ session: AdminSession } | { response: NextResponse }> {
  const session = await getSession();
  if (!session) {
    return {
      response: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }
  return { session };
}