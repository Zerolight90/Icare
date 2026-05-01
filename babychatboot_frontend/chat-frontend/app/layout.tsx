import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "./components/Header"; // 🟢 방금 만든 헤더 불러오기

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "iCare - 똑똑한 육아 비서",
  description: "유나 아빠 영환 님을 위한 맞춤형 육아 솔루션",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* 🟢 모든 페이지 상단에 헤더가 고정됩니다 */}
        <Header />

        {/* 🟡 페이지 본문 (헤더 높이만큼 pt-16 여백 추가) */}
        <main className="flex-1 pt-16">
          {children}
        </main>

        {/* 🟢 공통 푸터 (선택 사항) */}
        <footer className="py-8 text-center text-gray-400 text-xs border-t border-gray-50">
          © 2026 iCare Project. All rights reserved.
        </footer>
      </body>
    </html>
  );
}