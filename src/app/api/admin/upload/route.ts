import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

// ponytail: disk storage — swap for S3/Cloudinary when moving to multi-instance hosting.
// Stored outside public/ on purpose: `next start` snapshots public/ at boot, so
// files uploaded later would 404. Served via /api/uploads/menu/[file] instead.
const UPLOAD_DIR = join(process.cwd(), "data", "uploads", "menu");

/** Max 5 MB — plenty for menu photos, keeps uploads cheap to reject. */
const MAX_SIZE = 5 * 1024 * 1024;

/**
 * Preferred web formats (jpg/png/jpeg). Other image types are accepted too,
 * but jpg/png keeps quality + compression predictable across devices.
 */
const PREFERRED = new Set(["image/jpeg", "image/png"]);const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg", // jpg / jpeg both sniff as image/jpeg
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

/**
 * Magic-byte sniffing — never trust the client's Content-Type header alone.
 * HEAD bytes are unique per container, so this also blocks a .jpg-named
 * HTML/PHP/SVG file from being stored and served back to customers.
 */
function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  const b = bytes;
  // JPEG: FF D8 FF (+ any following bytes)
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  // PNG: 8-byte signature 89 50 4E 47 0D 0A 1A 0A
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a)
    return "image/png";
  // GIF87a / GIF89a
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38)
    return "image/gif";
  // RIFF....WEBP
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  )
    return "image/webp";
  // ISO-BMFF containers: ftyp + brand (avif / avis / mif1-heic aliases)
  const brand = String.fromCharCode(b[4], b[5], b[6], b[7]);
  if (
    b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 &&
    (brand === "avif" || brand === "avis" || brand === "mif1" || brand === "msf1")
  )
    return "image/avif";
  return null;
}

/** POST /api/admin/upload — multipart image upload, admin only. */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: "File upload tidak valid" },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: "Tidak ada file yang diunggah" },
      { status: 400 }
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ success: false, error: "File kosong" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { success: false, error: "Ukuran file maksimal 5 MB" },
      { status: 413 }
    );
  }

  // ponytail: declared Content-Type is attacker-controlled, so it is never
  // trusted — the file must genuinely match an image signature to pass.
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = sniffImageType(new Uint8Array(buffer.subarray(0, 16)));

  if (!mime || !ALLOWED_TYPES[mime]) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Format tidak didukung. Gunakan JPG, PNG, JPEG (utama), atau WebP/GIF/AVIF.",
      },
      { status: 400 }
    );
  }

  // ponytail: original filename is never used for storage — only the sniffed
  // extension + a random UUID, so path traversal via nama file mustahil.
  const ext = ALLOWED_TYPES[mime];
  const fileName = `${randomUUID()}${ext}`;
  const url = `/api/uploads/menu/${fileName}`;

  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(join(UPLOAD_DIR, fileName), buffer);
  } catch (err) {
    console.error("[upload]", err);
    return NextResponse.json(
      { success: false, error: "Gagal menyimpan file" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, url, preferred: PREFERRED.has(mime) });
}
