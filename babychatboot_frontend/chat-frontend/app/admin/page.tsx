'use client';

import { useEffect, useState } from 'react';
import api from '../lib/axios';

interface Stats {
  totalUsers: number;
  totalPosts: number;
  totalComments: number;
  totalBoards: number;
  totalDailyLogs: number;
  totalChatRooms: number;
  totalMessages: number;
  totalFamilies: number;
  totalNotices: number;
}

const STAT_CARDS = [
  { key: 'totalUsers',     label: '전체 회원',    icon: '👥', color: 'bg-blue-500' },
  { key: 'totalFamilies',  label: '가족 그룹',    icon: '👨‍👩‍👧', color: 'bg-purple-500' },
  { key: 'totalPosts',     label: '게시글',       icon: '📝', color: 'bg-green-500' },
  { key: 'totalComments',  label: '댓글',         icon: '💬', color: 'bg-yellow-500' },
  { key: 'totalBoards',    label: '게시판',       icon: '📋', color: 'bg-pink-500' },
  { key: 'totalChatRooms', label: '채팅방',       icon: '🤖', color: 'bg-indigo-500' },
  { key: 'totalMessages',  label: 'AI 메시지',    icon: '✉️', color: 'bg-cyan-500' },
  { key: 'totalDailyLogs', label: '일지 기록',    icon: '📅', color: 'bg-orange-500' },
  { key: 'totalNotices',   label: '공지사항',     icon: '📢', color: 'bg-red-500' },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/admin/stats')
      .then(res => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">iCare 서비스 현황 한눈에 보기</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {STAT_CARDS.map(card => (
            <div key={card.key} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className={`w-10 h-10 ${card.color} rounded-xl flex items-center justify-center text-xl mb-3`}>
                {card.icon}
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {stats ? (stats[card.key as keyof Stats] ?? 0).toLocaleString() : '-'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-bold text-gray-700 mb-4">빠른 이동</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/admin/users',     label: '회원 관리',    icon: '👥' },
            { href: '/admin/boards',    label: '게시판 관리',  icon: '📋' },
            { href: '/admin/notices',   label: '공지사항 작성', icon: '📢' },
            { href: '/admin/chatbot',   label: '챗봇 설정',    icon: '🤖' },
            { href: '/admin/documents', label: '문서 추가',    icon: '📚' },
            { href: '/admin/posts',     label: '게시물 검토',  icon: '📝' },
            { href: '/admin/dailylogs', label: '일지 현황',    icon: '📅' },
          ].map(item => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 hover:border-pink-300 hover:bg-pink-50 transition text-sm font-medium text-gray-700"
            >
              <span>{item.icon}</span>
              {item.label}
            </a>
          ))}
        </div>
      </div>

      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <p className="text-sm text-amber-700 font-medium">기본 관리자 계정</p>
        <p className="text-xs text-amber-600 mt-1">
          아이디: <code className="bg-amber-100 px-1 rounded">admin</code> &nbsp;
          비밀번호: <code className="bg-amber-100 px-1 rounded">admin1234!</code>
          &nbsp;— 운영 환경에서는 반드시 변경하세요.
        </p>
      </div>
    </div>
  );
}
