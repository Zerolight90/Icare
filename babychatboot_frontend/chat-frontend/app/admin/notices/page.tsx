'use client';

import { useEffect, useState } from 'react';
import api from '../../lib/axios';

interface Notice {
  id: number;
  title: string;
  content: string;
  pinned: boolean;
  active: boolean;
  createdAt: string;
  authorName?: string;
}

const EMPTY_FORM = { title: '', content: '', pinned: false };

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api.get('/api/admin/notices')
      .then(res => setNotices(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (n: Notice) => {
    setEditId(n.id);
    setForm({ title: n.title, content: n.content, pinned: n.pinned });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/api/admin/notices/${editId}`, form);
      } else {
        await api.post('/api/admin/notices', form);
      }
      setShowForm(false);
      load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (notice: Notice) => {
    await api.patch(`/api/admin/notices/${notice.id}/active`, { active: !notice.active });
    load();
  };

  const handleDelete = async (noticeId: number) => {
    if (!confirm('이 공지사항을 삭제하시겠습니까?')) return;
    await api.delete(`/api/admin/notices/${noticeId}`);
    load();
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">공지사항 관리</h1>
          <p className="text-sm text-gray-500 mt-1">공지사항 작성 및 관리</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-pink-500 text-white rounded-xl text-sm font-semibold hover:bg-pink-600 transition"
        >
          + 공지 작성
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notices.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <p className="text-3xl mb-2">📢</p>
          <p className="text-gray-500">작성된 공지사항이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map(notice => (
            <div key={notice.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div
                className="flex items-center gap-3 p-4 cursor-pointer"
                onClick={() => setExpanded(expanded === notice.id ? null : notice.id)}
              >
                {notice.pinned && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600 flex-shrink-0">
                    필수
                  </span>
                )}
                <p className={`flex-1 font-semibold text-gray-800 ${!notice.active ? 'line-through text-gray-400' : ''}`}>
                  {notice.title}
                </p>
                <span className="text-xs text-gray-400">{fmtDate(notice.createdAt)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${notice.active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  {notice.active ? '공개' : '비공개'}
                </span>
                <span className="text-gray-400">{expanded === notice.id ? '▲' : '▼'}</span>
              </div>

              {expanded === notice.id && (
                <div className="px-4 pb-4">
                  <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap mb-4">
                    {notice.content}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleActive(notice)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      {notice.active ? '비공개로 전환' : '공개로 전환'}
                    </button>
                    <button
                      onClick={() => openEdit(notice)}
                      className="px-3 py-1.5 rounded-lg border border-blue-200 text-xs text-blue-600 hover:bg-blue-50"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(notice.id)}
                      className="px-3 py-1.5 rounded-lg border border-red-200 text-xs text-red-500 hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 작성/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl">
            <h2 className="font-bold text-gray-800 text-lg mb-4">
              {editId ? '공지사항 수정' : '공지사항 작성'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">제목</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-pink-400"
                  placeholder="공지사항 제목"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">내용</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  rows={8}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-pink-400 resize-none"
                  placeholder="공지사항 내용을 입력하세요..."
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))}
                  className="w-4 h-4 accent-pink-500"
                />
                <span className="text-sm text-gray-700">필수 공지 (상단 고정)</span>
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title || !form.content}
                className="flex-1 py-2.5 rounded-xl bg-pink-500 text-white text-sm font-medium hover:bg-pink-600 disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
