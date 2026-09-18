import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join, basename, extname } from "node:path";

export const dynamic = "force-dynamic";

// ponytail: disk storage — swap for S3/Cloudinary when moving to multi-instance hosting.
// Files live in data/uploads/menu (gitignored) and are streamed by this handler
// because `next start` snapshots public/ at boot and would 404 newer files.
const UPLOAD_DIR = join(process.cwd(), "data", "uploads", "menu");

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

/**
 * GET /api/uploads/menu/[file] — serves admin-uploaded menu images.
 * basename() strips any path segments, so only files directly inside
 * UPLOAD_DIR are reachable (no traversal).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;

  const safeName = basename(file);
  if (!safeName || safeName.startsWith(".")) {
    return NextResponse.json({ success: false, error: "File tidak ditemukan" }, { status: 404 });
  }

  const mime = MIME_BY_EXT[extname(safeName).toLowerCase()];
  if (!mime) {
    return NextResponse.json({ success: false, error: "File tidak ditemukan" }, { status: 404 });
  }

  try {
    const content = await readFile(join(UPLOAD_DIR, safeName));
    return new NextResponse(new Uint8Array(content), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable", // nama file UUID — konten tidak pernah berubah
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "File tidak ditemukan" }, { status: 404 });
  }
}
