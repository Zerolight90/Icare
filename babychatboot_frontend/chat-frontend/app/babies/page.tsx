'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../lib/axios';
import Header from '../components/Header';

interface Baby {
  id: number;
  name: string;
  gender: string;
  birthDate: string;
  weight: number | null;
  height: number | null;
  specialNotes: string | null;
}

interface BabyForm {
  name: string;
  gender: string;
  birthDate: string;
  weight: string;
  height: string;
  specialNotes: string;
}

const emptyForm: BabyForm = { name: '', gender: 'U', birthDate: '', weight: '', height: '', specialNotes: '' };
const GENDER_LABEL: Record<string, string> = { M: '남아', F: '여아', U: '미정' };
const GENDER_ICON: Record<string, string> = { M: '👦', F: '👧', U: '👶' };

function calcAge(birthDate: string) {
  const birth = new Date(birthDate);
  const now = new Date();
  const days = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
  return `${days}일`;
}

export default function BabiesPage() {
  const router = useRouter();
  const [babies, setBabies] = useState<Baby[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<BabyForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/login'); return; }
    fetchBabies();
  }, [router]);

  const fetchBabies = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/babies');
      setBabies(res.data);
    } catch { router.push('/login'); }
    finally { setIsLoading(false); }
  };

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  };

  const openEdit = (b: Baby) => {
    setEditId(b.id);
    setForm({
      name: b.name,
      gender: b.gender,
      birthDate: b.birthDate,
      weight: b.weight != null ? String(b.weight) : '',
      height: b.height != null ? String(b.height) : '',
      specialNotes: b.specialNotes ?? '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('이름을 입력해주세요.'); return; }
    if (!form.birthDate) { setError('생년월일을 입력해주세요.'); return; }
    setSaving(true);
    setError('');
    const body = {
      name: form.name.trim(),
      gender: form.gender,
      birthDate: form.birthDate,
      weight: form.weight !== '' ? Number(form.weight) : null,
      height: form.height !== '' ? Number(form.height) : null,
      specialNotes: form.specialNotes || null,
    };
    try {
      if (editId != null) await api.put(`/api/babies/${editId}`, body);
      else await api.post('/api/babies', body);
      setShowModal(false);
      fetchBabies();
    } catch (e: unknown) {
      const err = e as { response?: { data?: string } };
      setError(err.response?.data || '저장에 실패했습니다.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`${name}의 정보를 삭제하시겠어요?\n일과 기록도 함께 삭제됩니다.`)) return;
    try {
      await api.delete(`/api/babies/${id}`);
      fetchBabies();
    } catch { alert('삭제에 실패했습니다.'); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-16">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">👶 아이 관리</h1>
            <p className="text-sm text-gray-500 mt-1">아이 정보는 AI 상담과 일과표 건강 문진에 활용됩니다</p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium rounded-xl shadow-sm transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            아이 추가
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
          </div>
        ) : babies.length === 0 ? (
          <div className="text-center py-20">
            <span className="text-6xl block mb-4">👶</span>
            <h2 className="text-lg font-semibold text-gray-700 mb-2">아직 등록된 아이가 없어요</h2>
            <p className="text-sm text-gray-500 mb-6">아이를 등록하면 AI 상담 및 건강 문진을 이용할 수 있어요</p>
            <button
              onClick={openAdd}
              className="px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white font-medium rounded-xl transition"
            >
              첫 번째 아이 등록하기
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {babies.map(baby => (
              <div key={baby.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-pink-50 border-2 border-pink-100 flex items-center justify-center text-3xl">
                      {GENDER_ICON[baby.gender] ?? '👶'}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">{baby.name}</h3>
                      <p className="text-sm text-gray-500">{GENDER_LABEL[baby.gender]} · {calcAge(baby.birthDate)} · {baby.birthDate}</p>
                      <div className="flex gap-3 mt-1.5">
                        {baby.weight != null && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">⚖️ {baby.weight}kg</span>
                        )}
                        {baby.height != null && (
                          <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">📏 {baby.height}cm</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(baby)}
                      className="text-xs text-gray-500 hover:text-pink-500 px-3 py-1.5 rounded-lg hover:bg-pink-50 transition"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(baby.id, baby.name)}
                      className="text-xs text-gray-400 hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition"
                    >
                      삭제
                    </button>
                  </div>
                </div>
                {baby.specialNotes && (
                  <div className="mt-3 pt-3 border-t border-gray-50">
                    <p className="text-xs text-gray-400 mb-0.5">특이사항</p>
                    <p className="text-sm text-gray-600">{baby.specialNotes}</p>
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => router.push('/dailylog')}
                    className="flex-1 text-xs py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                  >
                    📋 일과표 보기
                  </button>
                  <button
                    onClick={() => router.push('/chat')}
                    className="flex-1 text-xs py-2 rounded-xl border border-pink-200 text-pink-600 hover:bg-pink-50 transition"
                  >
                    💬 AI 상담하기
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 등록/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">
                {editId != null ? '아이 정보 수정' : '아이 등록'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">입력한 정보는 AI 상담에 활용됩니다</p>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className={lbl}>이름 *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="아이 이름"
                  className={inp}
                />
              </div>

              <div>
                <label className={lbl}>성별 *</label>
                <div className="flex gap-2">
                  {(['M', 'F', 'U'] as const).map(g => (
                    <button
                      key={g}
                      onClick={() => setForm(f => ({ ...f, gender: g }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition ${
                        form.gender === g
                          ? 'border-pink-400 bg-pink-50 text-pink-600'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {GENDER_ICON[g]} {GENDER_LABEL[g]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={lbl}>생년월일 *</label>
                <input
                  type="date"
                  value={form.birthDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))}
                  className={inp}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>몸무게 (kg)</label>
                  <input
                    type="number"
                    min="0" max="30" step="0.1"
                    value={form.weight}
                    onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
                    placeholder="예: 7.5"
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>키 (cm)</label>
                  <input
                    type="number"
                    min="0" max="200" step="0.5"
                    value={form.height}
                    onChange={e => setForm(f => ({ ...f, height: e.target.value }))}
                    placeholder="예: 68.0"
                    className={inp}
                  />
                </div>
              </div>

              <div>
                <label className={lbl}>특이사항</label>
                <textarea
                  value={form.specialNotes}
                  onChange={e => setForm(f => ({ ...f, specialNotes: e.target.value }))}
                  placeholder="알레르기, 기저질환, 복용 중인 약 등을 입력하세요"
                  rows={3}
                  maxLength={500}
                  className={inp + ' resize-none'}
                />
                <p className="text-xs text-gray-400 text-right mt-1">{form.specialNotes.length}/500</p>
              </div>

              {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-pink-500 hover:bg-pink-600 disabled:bg-pink-300 text-white text-sm font-semibold transition"
              >
                {saving ? '저장 중...' : editId != null ? '수정 완료' : '등록하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5';
const inp = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition';
