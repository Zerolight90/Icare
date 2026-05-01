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

  // isMounted 제거 후 useEffect 하나로 통합
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      api.get('/api/users/me')
        .then(res => {
          setIsLoggedIn(true);
          setUserName(res.data.nickname);
        })
        .catch(err => {
          console.error("유저 정보 로드 실패:", err);
          //handleLogout();
        });
    }
  }, [handleLogout]);

  return (
    <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold text-pink-500 flex items-center gap-2">
          👶 <span className="hidden sm:block">iCare</span>
        </Link>

        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">
                <span className="text-pink-500 font-bold">{userName}</span>님 환영합니다!
              </span>
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