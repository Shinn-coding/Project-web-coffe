import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Seed menu images (source.unsplash.com redirects to images.unsplash.com)
      { protocol: "https", hostname: "source.unsplash.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.pinimg.com" },
      // Vercel Blob uploads (menu photos, shop logo) — actual store URLs are
      // <store-id>.public.blob.vercel-storage.com
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
