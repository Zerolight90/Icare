'use client';

import { useEffect, useState } from 'react';
import api from '../../lib/axios';

interface AdminItem {
  id: number;
  username: string;
  name: string;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

const EMPTY_FORM = { username: '', password: '', name: '' };

export default function AdminAccountsPage() {
  const [admins, setAdmins] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api.get('/api/admin/admins')
      .then(res => setAdmins(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (a: AdminItem) => {
    await api.patch(`/api/admin/admins/${a.id}/active`, { active: !a.active });
    load();
  };

  const handleCreate = async () => {
    if (!form.username || !form.password) return;
    setSaving(true);
    setFormError('');
    try {
      await api.post('/api/admin/admins', {
        username: form.username,
        password: form.password,
        name: form.name || form.username,
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err: any) {
      setFormError(err.response?.data?.error ?? '관리자 계정 생성에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/api/admin/admins/${id}`);
    setConfirmDelete(null);
    load();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">관리자 계정 관리</h1>
          <p className="text-sm text-gray-500 mt-1">관리자 콘솔에 접근할 수 있는 계정 목록</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setFormError(''); setForm(EMPTY_FORM); }}
          className="px-4 py-2 bg-purple-500 text-white rounded-xl text-sm font-semibold hover:bg-purple-600 transition"
        >
          + 관리자 추가
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">아이디</th>
                  <th className="px-4 py-3 text-left">이름</th>
                  <th className="px-4 py-3 text-center">상태</th>
                  <th className="px-4 py-3 text-center">생성일</th>
                  <th className="px-4 py-3 text-center">마지막 로그인</th>
                  <th className="px-4 py-3 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {admins.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-gray-400">{a.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{a.username}</td>
                    <td className="px-4 py-3 text-gray-600">{a.name}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(a)}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition ${
                          a.active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-600 hover:bg-red-200'
                        }`}
                      >
                        {a.active ? '활성' : '비활성'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                      {a.createdAt ? new Date(a.createdAt).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                      {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('ko-KR') : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.username !== 'admin' && (
                        <button
                          onClick={() => setConfirmDelete(a.id)}
                          className="text-xs text-red-400 hover:text-red-600 transition"
                        >
                          삭제
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {admins.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-10">관리자 계정이 없습니다.</p>
            )}
          </div>
        )}
      </div>

      {/* 관리자 추가 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <p className="font-bold text-gray-800 text-lg mb-1">관리자 계정 추가</p>
            <p className="text-xs text-gray-400 mb-4">새 관리자 콘솔 접근 계정을 생성합니다.</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">아이디</label>
                <input
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-purple-400"
                  placeholder="예: admin2"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">비밀번호</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-purple-400"
                  placeholder="비밀번호"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">이름</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-purple-400"
                  placeholder="홍길동"
                />
              </div>
              {formError && (
                <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{formError}</p>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !form.username || !form.password}
                className="flex-1 py-2 rounded-xl bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 disabled:opacity-50"
              >
                {saving ? '생성 중...' : '관리자 생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-80 shadow-xl">
            <p className="font-bold text-gray-800 mb-2">관리자 계정 삭제</p>
            <p className="text-sm text-gray-500 mb-5">이 관리자 계정을 삭제하시겠습니까?</p>
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
