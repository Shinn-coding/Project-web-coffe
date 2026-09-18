import type { Prisma } from "@prisma/client";

/**
 * Data toko yang tampil di struk customer.
 *
 * Nilai di sini adalah FALLBACK — identitas asli diedit dari dashboard admin
 * (Pengaturan → Identitas Toko) dan tersimpan di tabel ShopSetting (kolom
 * shopName / shopAddress / shopPhone / logoUrl). Kolom yang kosong di DB
 * otomatis jatuh ke nilai default di bawah ini.
 */
export const SHOP_INFO = {
  /** Nama toko — tampil sebagai judul/header struk */
  name: "Kopi Senja",
  /** Alamat singkat — tampil di bawah nama toko */
  address: "Jl. Raya Kopi No. 12, Bandung",
  /** Kontak utama — tampil di header struk & baris kritik/saran di footer */
  phone: "0812-3456-7890",
} as const;

/** Identitas toko hasil gabungan DB + fallback — semua field selalu terisi. */
export interface EffectiveShopInfo {
  name: string;
  address: string;
  phone: string;
  logoUrl: string | null;
}

/** Shape kolom identitas di tabel ShopSetting (semua opsional). */
export type ShopIdentityInput = Pick<
  Prisma.ShopSettingUncheckedCreateInput,
  "shopName" | "shopAddress" | "shopPhone" | "logoUrl"
>;

/**
 * Gabungkan identitas dari DB dengan fallback SHOP_INFO.
 * Field DB yang null/ kosong digantikan nilai default.
 */
export function effectiveShopInfo(identity: ShopIdentityInput | null | undefined): EffectiveShopInfo {
  const pick = (v: string | null | undefined): string | null => {
    const t = v?.trim();
    return t ? t : null;
  };
  return {
    name: pick(identity?.shopName) ?? SHOP_INFO.name,
    address: pick(identity?.shopAddress) ?? SHOP_INFO.address,
    phone: pick(identity?.shopPhone) ?? SHOP_INFO.phone,
    logoUrl: pick(identity?.logoUrl),
  };
}
