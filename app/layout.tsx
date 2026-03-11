import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import EnergyRing from "@/components/EnergyRing";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Vibe-Energy-Schedules",
  description: "日程时间精力管理系统",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className={`${inter.className} bg-gray-900 text-gray-100 min-h-screen`}>
        <header className="sticky top-0 z-50 border-b border-gray-700 bg-gray-900/95 backdrop-blur">
          <EnergyRing />
        </header>
        <main className="container mx-auto px-4 py-6 max-w-2xl">
          {children}
        </main>
      </body>
    </html>
  );
}
