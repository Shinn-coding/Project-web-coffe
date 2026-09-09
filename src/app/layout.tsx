import type { Metadata } from "next";
import { Inter } from "next/font/google";
import PageTransition from "@/components/page-transition";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kopi Senja — Pesan Online",
  description: "Pesan kopi, non-kopi, dan pastry secara online. Bayar di kasir.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
    <PageTransition>{children}</PageTransition>
  </body>
    </html>
  );
}