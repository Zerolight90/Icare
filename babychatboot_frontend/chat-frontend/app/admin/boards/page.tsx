'use client';

import { useEffect, useState } from 'react';
import api from '../../lib/axios';

interface Board {
  id: number;
  name: string;
  description: string;
  displayOrder: number;
  boardType: string;
  active: boolean;
}

const EMPTY_FORM = { name: '', description: '', displayOrder: 1, boardType: 'COMMUNITY' };

export default function AdminBoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/api/admin/boards')
      .then(res => setBoards(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (b: Board) => {
    setEditId(b.id);
    setForm({ name: b.name, description: b.description, displayOrder: b.displayOrder, boardType: b.boardType });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/api/admin/boards/${editId}`, form);
      } else {
        await api.post('/api/admin/boards', form);
      }
      setShowForm(false);
      load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (board: Board) => {
    await api.patch(`/api/admin/boards/${board.id}/active`, { active: !board.active });
    load();
  };

  const handleDelete = async (boardId: number) => {
    if (!confirm('게시판을 삭제하면 모든 게시글도 삭제됩니다. 계속하시겠습니까?')) return;
    await api.delete(`/api/admin/boards/${boardId}`);
    load();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">게시판 관리</h1>
          <p className="text-sm text-gray-500 mt-1">게시판 추가·수정·삭제 및 노출 순서 관리</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-sky-500 text-white rounded-xl text-sm font-semibold hover:bg-sky-600 transition"
        >
          + 게시판 추가
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">순서</th>
                <th className="px-4 py-3 text-left">게시판 이름</th>
                <th className="px-4 py-3 text-left">설명</th>
                <th className="px-4 py-3 text-center">유형</th>
                <th className="px-4 py-3 text-center">상태</th>
                <th className="px-4 py-3 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {boards
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map(board => (
                  <tr key={board.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 font-mono">{board.displayOrder}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{board.name}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{board.description}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        board.boardType === 'MEDICAL'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-sky-100 text-sky-700'
                      }`}>
                        {board.boardType === 'MEDICAL' ? '의학' : '커뮤니티'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(board)}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition ${
                          board.active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {board.active ? '노출' : '숨김'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => openEdit(board)}
                          className="text-xs text-blue-500 hover:text-blue-700"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(board.id)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 폼 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="font-bold text-gray-800 mb-4">
              {editId ? '게시판 수정' : '게시판 추가'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">게시판 이름</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-sky-400"
                  placeholder="예: 자유게시판"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">설명</label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-sky-400"
                  placeholder="게시판 설명"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">노출 순서</label>
                  <input
                    type="number"
                    value={form.displayOrder}
                    onChange={e => setForm(f => ({ ...f, displayOrder: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-sky-400"
                    min={1}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">유형</label>
                  <select
                    value={form.boardType}
                    onChange={e => setForm(f => ({ ...f, boardType: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-sky-400"
                  >
                    <option value="COMMUNITY">커뮤니티</option>
                    <option value="MEDICAL">의학 상담</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name}
                className="flex-1 py-2 rounded-xl bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 disabled:opacity-50"
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
