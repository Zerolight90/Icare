'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import api from '../lib/axios';

export default function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');

  const handleLogout = useCallback(() => {
    localStorage.removeItem('accessToken');
    setIsLoggedIn(false);
    setUserName('');
    if (window.location.pathname !== '/') {
      window.location.href = '/';
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    // 토큰이 있으면 즉시 로그인 상태로 표시 (API 응답 기다리지 않음)
    setIsLoggedIn(true);
    api.get('/api/users/me')
      .then(res => setUserName(res.data.nickname ?? ''))
      .catch(err => {
        // 토큰 만료 or 유효하지 않은 경우만 로그아웃
        if (err?.response?.status === 401) handleLogout();
      });
  }, [handleLogout]);

  return (
    <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold text-pink-500 flex items-center gap-2">
          👶 <span className="hidden sm:block">iCare</span>
        </Link>

        {/* 네비게이션 */}
        <nav className="hidden md:flex items-center gap-1">
          <Link href="/community" className="text-sm text-gray-500 hover:text-pink-500 transition px-3 py-1.5 rounded-lg hover:bg-pink-50">
            커뮤니티
          </Link>
          <Link href="/hospitals" className="text-sm text-gray-500 hover:text-pink-500 transition px-3 py-1.5 rounded-lg hover:bg-pink-50">
            병원찾기
          </Link>
          <Link href="/chat" className="text-sm text-gray-500 hover:text-pink-500 transition px-3 py-1.5 rounded-lg hover:bg-pink-50">
            AI 상담
          </Link>
          <Link href="/dailylog" className="text-sm text-gray-500 hover:text-pink-500 transition px-3 py-1.5 rounded-lg hover:bg-pink-50">
            일과표
          </Link>
          <Link href="/babies" className="text-sm text-gray-500 hover:text-pink-500 transition px-3 py-1.5 rounded-lg hover:bg-pink-50">
            아이관리
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 hidden sm:block">
                <span className="text-pink-500 font-bold">{userName}</span>님
              </span>
              <Link
                href="/mypage"
                className="text-xs font-medium text-gray-500 hover:text-pink-500 transition px-2 py-1 rounded-lg hover:bg-pink-50"
              >
                마이페이지
              </Link>
              <button
                onClick={handleLogout}
                className="text-xs text-gray-400 hover:text-red-500 transition"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                로그인
              </Link>
              <Link href="/signup" className="text-sm font-medium bg-pink-500 text-white px-4 py-2 rounded-2xl hover:bg-pink-600 transition shadow-sm">
                시작하기
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}