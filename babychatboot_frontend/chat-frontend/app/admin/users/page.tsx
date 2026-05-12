'use client';

import { useEffect, useState } from 'react';
import api from '../../lib/axios';

interface UserItem {
  id: number;
  email: string;
  name: string;
  nickname: string;
  role: string;
  provider: string;
  emailVerified: boolean;
}

const ROLE_LABELS: Record<string, string> = { MOM: '엄마', DAD: '아빠' };
const ROLE_COLORS: Record<string, string> = {
  MOM: 'bg-sky-100 text-sky-700',
  DAD: 'bg-blue-100 text-blue-700',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [filtered, setFiltered] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api.get('/api/admin/users')
      .then(res => { setUsers(res.data); setFiltered(res.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(users.filter(u =>
      u.email.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      u.nickname.toLowerCase().includes(q)
    ));
  }, [search, users]);

  const handleDelete = async (userId: number) => {
    await api.delete(`/api/admin/users/${userId}`);
    setConfirmDelete(null);
    load();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">회원 관리</h1>
        <p className="text-sm text-gray-500 mt-1">가입한 일반 회원 목록 및 계정 관리</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <input
            type="text"
            placeholder="이메일 / 이름 / 닉네임 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-sky-400"
          />
          <span className="text-sm text-gray-400">{filtered.length}명</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">이메일</th>
                  <th className="px-4 py-3 text-left">이름/닉네임</th>
                  <th className="px-4 py-3 text-center">역할</th>
                  <th className="px-4 py-3 text-center">가입방식</th>
                  <th className="px-4 py-3 text-center">이메일 인증</th>
                  <th className="px-4 py-3 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-gray-400">{user.id}</td>
                    <td className="px-4 py-3 text-gray-700">{user.email}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{user.name}</p>
                      <p className="text-xs text-gray-400">@{user.nickname}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">{user.provider}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium ${user.emailVerified ? 'text-green-600' : 'text-red-400'}`}>
                        {user.emailVerified ? '완료' : '미완료'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setConfirmDelete(user.id)}
                        className="text-xs text-red-400 hover:text-red-600 transition"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-10">검색 결과가 없습니다.</p>
            )}
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-80 shadow-xl">
            <p className="font-bold text-gray-800 mb-2">회원 삭제</p>
            <p className="text-sm text-gray-500 mb-5">
              이 계정을 삭제하면 복구할 수 없습니다. 정말 삭제하시겠습니까?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
