'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import api from '../lib/axios';

function parseToken(token: string): { role: string | null; subject: string | null } {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { role: payload.role ?? null, subject: payload.sub ?? null };
  } catch { return { role: null, subject: null }; }
}

export default function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

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
    const { role, subject } = parseToken(token);
    setIsLoggedIn(true);
    if (role === 'ADMIN') {
      setIsAdmin(true);
      setUserName(subject ?? '관리자');
      return;
    }
    api.get('/api/users/me')
      .then(res => setUserName(res.data.nickname ?? ''))
      .catch(err => {
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
              {isAdmin && (
                <Link
                  href="/admin"
                  className="text-xs font-medium text-purple-600 hover:text-purple-700 transition px-2 py-1 rounded-lg hover:bg-purple-50 border border-purple-200"
                >
                  관리자
                </Link>
              )}
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