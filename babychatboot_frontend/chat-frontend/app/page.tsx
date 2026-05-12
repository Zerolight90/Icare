'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import Header from './components/Header';

export default function LandingPage() {
  const [isLoggedIn] = useState<boolean>(() =>
    typeof window !== 'undefined' && !!localStorage.getItem('accessToken')
  );

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center pt-16">
        <div className="mb-8">
          <div className="flex justify-center mb-5">
            <Image src="/logo.png" alt="iCare 로고" width={96} height={96} className="rounded-2xl shadow-lg" />
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
            똑똑한 육아 비서, <span className="text-sky-500">iCare</span>
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-md mx-auto">
            복잡한 육아 기록부터 AI 전문 상담까지,<br />
            가족 모두를 위한 맞춤형 솔루션입니다.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-12 w-full max-w-md">
          <Link href="/chat" className="p-4 bg-sky-50 rounded-2xl flex items-center gap-3 hover:bg-sky-100 transition cursor-pointer">
            <span className="text-2xl">💬</span>
            <p className="text-sm font-medium text-gray-700 text-left">AI 육아 상담</p>
          </Link>
          <Link href="/dailylog" className="p-4 bg-blue-50 rounded-2xl flex items-center gap-3 hover:bg-blue-100 transition cursor-pointer">
            <span className="text-2xl">📋</span>
            <p className="text-sm font-medium text-gray-700 text-left">하루 일과표</p>
          </Link>
          <Link href="/hospitals" className="p-4 bg-green-50 rounded-2xl flex items-center gap-3 hover:bg-green-100 transition cursor-pointer">
            <span className="text-2xl">🏥</span>
            <p className="text-sm font-medium text-gray-700 text-left">병원 찾기</p>
          </Link>
          <Link href="/community" className="p-4 bg-yellow-50 rounded-2xl flex items-center gap-3 hover:bg-yellow-100 transition cursor-pointer">
            <span className="text-2xl">👥</span>
            <p className="text-sm font-medium text-gray-700 text-left">육아 커뮤니티</p>
          </Link>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-sm">
          <Link href="/chat" className="bg-sky-500 hover:bg-sky-600 text-white font-bold py-4 rounded-2xl text-lg shadow-lg transition active:scale-95 text-center">
            AI 상담 시작하기
          </Link>
          {!isLoggedIn && (
            <Link href="/login" className="bg-white border-2 border-sky-200 hover:border-sky-400 text-sky-500 font-bold py-3.5 rounded-2xl text-base transition text-center">
              로그인하기
            </Link>
          )}
        </div>

        <footer className="mt-12 text-gray-400 text-xs">
          © 2026 iCare Project. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
