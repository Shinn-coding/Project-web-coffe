import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

/** "HH:mm" 24-hour format, e.g. 08:00, 22:30 */
const HOUR_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Trim to string|null — undefined/empty/whitespace → null (identity fields are all optional) */
const textOrNull = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
};

/**
 * GET /api/settings — public. Hours (or null when banner off) plus the shop
 * identity shown on the customer receipt. Hours live at the top level so
 * existing consumers (`data.openHour`, null-checks) keep working untouched;
 * identity is a separate nested object, null-safe in every field.
 */
export async function GET() {
  try {
    const row = await prisma.shopSetting.findUnique({ where: { id: 1 } });
    const hours =
      row && row.openHour && row.closeHour
        ? { openHour: row.openHour, closeHour: row.closeHour }
        : null;
    return NextResponse.json({
      success: true,
      data: {
        ...hours, // spread of null → {} keeps shape stable for old consumers
        identity: {
          shopName: row?.shopName ?? null,
          shopAddress: row?.shopAddress ?? null,
          shopPhone: row?.shopPhone ?? null,
          logoUrl: row?.logoUrl ?? null,
        },
      },
    });
  } catch (err) {
    console.error("[settings GET] identity/hours load failed", err);
    return NextResponse.json({ success: false, error: "Gagal memuat pengaturan" }, { status: 500 });
  }
}

/** PUT /api/settings — admin only. Hours must be "HH:mm" | null; identity fields string | null. */
export async function PUT(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  // ponytail: strict type check — only String or null pass, anything else is a 400
  const isHourOrNull = (v: unknown): v is string | null => typeof v === "string" || v === null;

  let body: {
    openHour?: unknown;
    closeHour?: unknown;
    identity?: {
      shopName?: unknown;
      shopAddress?: unknown;
      shopPhone?: unknown;
      logoUrl?: unknown;
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Body tidak valid" }, { status: 400 });
  }

  const { openHour, closeHour } = body;
  if (!isHourOrNull(openHour) || !isHourOrNull(closeHour)) {
    return NextResponse.json({ success: false, error: "Format jam invalid (contoh: 08:00)" }, { status: 400 });
  }
  if ((openHour !== null && !HOUR_RE.test(openHour)) || (closeHour !== null && !HOUR_RE.test(closeHour))) {
    return NextResponse.json({ success: false, error: "Format jam invalid (contoh: 08:00)" }, { status: 400 });
  }

  const raw = body.identity ?? {};
  // ponytail: identity values are trimmed + length-capped so a bloated payload
  // can't smuggle oversized strings into the receipt render path.
  const identity = {
    shopName: textOrNull(raw.shopName)?.slice(0, 80) ?? null,
    shopAddress: textOrNull(raw.shopAddress)?.slice(0, 200) ?? null,
    shopPhone: textOrNull(raw.shopPhone)?.slice(0, 40) ?? null,
    logoUrl: textOrNull(raw.logoUrl)?.slice(0, 500) ?? null,
  };

  try {
    const saved = await prisma.shopSetting.upsert({
      where: { id: 1 },
      update: { openHour, closeHour, ...identity },
      create: { id: 1, openHour, closeHour, ...identity },
    });
    revalidatePath("/");
    return NextResponse.json({
      success: true,
      data: {
        openHour: saved.openHour,
        closeHour: saved.closeHour,
        identity: {
          shopName: saved.shopName,
          shopAddress: saved.shopAddress,
          shopPhone: saved.shopPhone,
          logoUrl: saved.logoUrl,
        },
      },
    });
  } catch (err) {
    console.error("[settings PUT]", err);
    return NextResponse.json({ success: false, error: "Gagal menyimpan pengaturan" }, { status: 500 });
  }
}
