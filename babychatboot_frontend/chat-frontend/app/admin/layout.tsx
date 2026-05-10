'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/admin', label: '대시보드', icon: '📊', exact: true },
  { href: '/admin/users', label: '회원 관리', icon: '👥' },
  { href: '/admin/admins', label: '관리자 계정', icon: '🔐' },
  { href: '/admin/posts', label: '게시물 관리', icon: '📝' },
  { href: '/admin/boards', label: '게시판 관리', icon: '📋' },
  { href: '/admin/notices', label: '공지사항', icon: '📢' },
  { href: '/admin/chatbot', label: '챗봇 관리', icon: '🤖' },
  { href: '/admin/documents', label: '문서/임베딩', icon: '📚' },
  { href: '/admin/dailylogs', label: '일지 관리', icon: '📅' },
];

function getRoleFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role ?? null;
  } catch {
    return null;
  }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (isLoginPage) return;
    const token = localStorage.getItem('accessToken');
    if (!token) { router.replace('/admin/login'); return; }
    const role = getRoleFromToken(token);
    if (role !== 'ADMIN') { router.replace('/admin/login'); }
  }, [router, isLoginPage]);

  if (isLoginPage) return <>{children}</>;

  const isActive = (item: { href: string; exact?: boolean }) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-gray-900 text-white z-30 flex flex-col transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:z-auto`}
      >
        <div className="p-5 border-b border-gray-700">
          <Link href="/" className="flex items-center gap-2 text-white">
            <span className="text-2xl">👶</span>
            <div>
              <p className="font-bold text-lg leading-tight">iCare</p>
              <p className="text-xs text-gray-400">관리자 콘솔</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition
                ${isActive(item)
                  ? 'bg-pink-500 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-700 space-y-2">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition"
          >
            <span>←</span> 사이트로 돌아가기
          </Link>
          <button
            onClick={() => { localStorage.removeItem('accessToken'); router.replace('/admin/login'); }}
            className="flex items-center gap-2 text-gray-400 hover:text-red-400 text-sm transition w-full"
          >
            <span>⏏</span> 로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 모바일 헤더 */}
        <header className="md:hidden bg-white border-b border-gray-200 px-4 h-14 flex items-center gap-3 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            ☰
          </button>
          <span className="font-semibold text-gray-800">관리자 콘솔</span>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
