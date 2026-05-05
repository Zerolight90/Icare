import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "iCare - 똑똑한 육아 비서",
  description: "AI 기반 맞춤형 육아 솔루션",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="h-full flex flex-col font-sans">
        <main className="flex-1 flex flex-col min-h-0">
          {children}
        </main>
      </body>
    </html>
  );
}
