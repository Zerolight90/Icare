'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../lib/axios';
import Header from '../components/Header';

const localDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface Baby {
  id: number;
  name: string;
  gender: string;
  birthDate: string;
}

interface DailyLog {
  id: number;
  recordTime: string;
  formulaAmount: number | null;
  breastfed: boolean | null;
  diaperType: string | null;
  memo: string | null;
  writerNickname: string;
}

interface LogForm {
  date: string;
  time: string;
  formulaAmount: string;
  breastfed: boolean;
  diaperType: string;
  memo: string;
}

const defaultForm: LogForm = {
  date: localDateStr(),
  time: new Date().toTimeString().slice(0, 5),
  formulaAmount: '',
  breastfed: false,
  diaperType: 'NONE',
  memo: '',
};

const DIAPER_LABELS: Record<string, string> = {
  NONE: '-',
  WET: '💧 소변',
  DIRTY: '💩 대변',
  BOTH: '💧💩 소변+대변',
};

const GENDER_ICON: Record<string, string> = { M: '👦', F: '👧', U: '👶' };

export default function DailyLogPage() {
  const router = useRouter();
  const [babies, setBabies] = useState<Baby[]>([]);
  const [selectedBaby, setSelectedBaby] = useState<Baby | null>(null);
  const [viewDate, setViewDate] = useState(localDateStr());
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<LogForm>(defaultForm);
  const [formMsg, setFormMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // 건강 문진
  const [healthResult, setHealthResult] = useState('');
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [showHealthPanel, setShowHealthPanel] = useState(false);

  // 다운로드 날짜 범위
  const [dlFrom, setDlFrom] = useState(localDateStr());
  const [dlTo, setDlTo] = useState(localDateStr());
  const [showDlPanel, setShowDlPanel] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/login'); return; }
    fetchBabies();
  }, []);

  useEffect(() => {
    if (selectedBaby) fetchLogs();
  }, [selectedBaby, viewDate]);

  const fetchBabies = async () => {
    try {
      const res = await api.get('/api/users/profile');
      const list: Baby[] = res.data.babies ?? [];
      setBabies(list);
      if (list.length > 0) setSelectedBaby(list[0]);
    } catch {
      router.push('/login');
    }
  };

  const fetchLogs = async () => {
    if (!selectedBaby) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/api/logs/${selectedBaby.id}?date=${viewDate}`);
      setLogs(res.data);
    } catch {
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ ...defaultForm, date: viewDate });
    setFormMsg('');
    setShowForm(true);
  };

  const openEdit = (log: DailyLog) => {
    const dt = new Date(log.recordTime);
    setEditId(log.id);
    setForm({
      date: localDateStr(dt),
      time: dt.toTimeString().slice(0, 5),
      formulaAmount: log.formulaAmount != null ? String(log.formulaAmount) : '',
      breastfed: log.breastfed ?? false,
      diaperType: log.diaperType ?? 'NONE',
      memo: log.memo ?? '',
    });
    setFormMsg('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!selectedBaby) return;
    setSaving(true);
    setFormMsg('');
    try {
      const recordTime = `${form.date}T${form.time}:00`;
      const body = {
        recordTime,
        formulaAmount: form.formulaAmount !== '' ? Number(form.formulaAmount) : null,
        breastfed: form.breastfed,
        diaperType: form.diaperType,
        memo: form.memo || null,
      };
      if (editId != null) {
        await api.put(`/api/logs/entry/${editId}`, body);
      } else {
        await api.post(`/api/logs/${selectedBaby.id}`, body);
      }
      setShowForm(false);
      fetchLogs();
    } catch (e: unknown) {
      const err = e as { response?: { data?: string } };
      setFormMsg(err.response?.data || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (logId: number) => {
    if (!confirm('이 기록을 삭제하시겠어요?')) return;
    try {
      await api.delete(`/api/logs/entry/${logId}`);
      fetchLogs();
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  const shiftDate = (delta: number) => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() + delta);
    setViewDate(localDateStr(d));
  };

  // CSV 다운로드 - 백엔드에서 직접 생성
  const handleDownload = async () => {
    if (!selectedBaby) return;
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(
        `/api/logs/${selectedBaby.id}/export?from=${dlFrom}&to=${dlTo}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('다운로드 실패');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedBaby.name}_일과표_${dlFrom}_${dlTo}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowDlPanel(false);
    } catch {
      alert('다운로드에 실패했습니다.');
    }
  };

  const handleHealthCheck = async () => {
    if (!selectedBaby || logs.length === 0) {
      alert('건강 문진을 위해 오늘 기록이 필요합니다.');
      return;
    }
    setIsCheckingHealth(true);
    setHealthResult('');
    setShowHealthPanel(true);
    try {
      const res = await api.post(`/api/logs/${selectedBaby.id}/health-check?date=${viewDate}`);
      setHealthResult(res.data.result);
    } catch {
      setHealthResult('AI 건강 문진 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const totalFormula = logs.reduce((sum, l) => sum + (l.formulaAmount ?? 0), 0);
  const breastfeedCount = logs.filter(l => l.breastfed).length;
  const diaperWet = logs.filter(l => l.diaperType === 'WET' || l.diaperType === 'BOTH').length;
  const diaperDirty = logs.filter(l => l.diaperType === 'DIRTY' || l.diaperType === 'BOTH').length;

  const todayStr = localDateStr();
  const isToday = viewDate === todayStr;

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-16">

        {/* 제목 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">📋 하루 일과표</h1>
          <div className="flex gap-2">
            {selectedBaby && logs.length > 0 && (
              <button
                onClick={handleHealthCheck}
                disabled={isCheckingHealth}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-sm text-blue-600 hover:bg-blue-100 transition shadow-sm disabled:opacity-50"
              >
                🩺 AI 건강 문진
              </button>
            )}
            <button
              onClick={() => setShowDlPanel(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition shadow-sm"
            >
              📥 엑셀 다운로드
            </button>
          </div>
        </div>

        {/* 건강 문진 패널 */}
        {showHealthPanel && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-blue-100 mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🩺</span>
                <h3 className="font-semibold text-gray-800 text-sm">AI 건강 문진 결과</h3>
                <span className="text-xs text-gray-400">({viewDate})</span>
              </div>
              <button onClick={() => setShowHealthPanel(false)} className="text-gray-400 hover:text-gray-600 transition">✕</button>
            </div>

            {/* 일일 요약 */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{totalFormula}</p>
                <p className="text-xs text-blue-400 mt-0.5">분유(ml)</p>
              </div>
              <div className="bg-rose-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-rose-500">{breastfeedCount}</p>
                <p className="text-xs text-rose-400 mt-0.5">수유(회)</p>
              </div>
              <div className="bg-yellow-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-yellow-600">{diaperWet}</p>
                <p className="text-xs text-yellow-500 mt-0.5">💧소변</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{diaperDirty}</p>
                <p className="text-xs text-amber-500 mt-0.5">💩대변</p>
              </div>
            </div>

            {isCheckingHealth ? (
              <div className="flex items-center gap-3 py-4 text-gray-500 text-sm">
                <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin flex-shrink-0" />
                AI 닥터 의비스가 오늘 기록을 분석하고 있습니다...
              </div>
            ) : healthResult ? (
              <div className="prose prose-sm max-w-none text-gray-700 text-sm leading-7
                [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-800 [&_h3]:mt-3 [&_h3]:mb-1
                [&_ul]:pl-5 [&_ul]:space-y-1 [&_li]:text-gray-600
                [&_strong]:text-gray-800 [&_strong]:font-semibold
                [&_p]:my-2">
                <div dangerouslySetInnerHTML={{ __html: healthResult.replace(/\n/g, '<br/>') }} />
              </div>
            ) : null}
          </div>
        )}

        {/* 다운로드 패널 */}
        {showDlPanel && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">📥 기간 선택 후 다운로드</p>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs text-gray-500 block mb-1">시작일</label>
                <input type="date" value={dlFrom} onChange={e => setDlFrom(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-sky-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">종료일</label>
                <input type="date" value={dlTo} onChange={e => setDlTo(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-sky-400" />
              </div>
              <button onClick={handleDownload}
                className="px-4 py-2 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition">
                CSV 다운로드
              </button>
            </div>
          </div>
        )}

        {/* 아기 없음 안내 */}
        {babies.length === 0 && (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
            <p className="text-4xl mb-3">👶</p>
            <p className="font-semibold text-gray-700 mb-1">등록된 아이가 없어요</p>
            <p className="text-sm text-gray-400 mb-5">회원가입 또는 마이페이지에서 아이를 추가해주세요</p>
            <button onClick={() => router.push('/mypage')}
              className="px-4 py-2 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition">
              마이페이지로 이동
            </button>
          </div>
        )}

        {babies.length > 0 && (
          <>
            {/* 아기 탭 */}
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
              {babies.map(baby => (
                <button
                  key={baby.id}
                  onClick={() => setSelectedBaby(baby)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition shadow-sm border ${
                    selectedBaby?.id === baby.id
                      ? 'bg-sky-500 text-white border-sky-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span>{GENDER_ICON[baby.gender] ?? '👶'}</span>
                  <span>{baby.name}</span>
                </button>
              ))}
            </div>

            {/* 날짜 네비게이션 */}
            <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 mb-4">
              <button onClick={() => shiftDate(-1)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition">
                ‹
              </button>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={viewDate}
                  max={todayStr}
                  onChange={e => setViewDate(e.target.value)}
                  className="text-center font-semibold text-gray-800 text-sm focus:outline-none cursor-pointer"
                />
                {!isToday && (
                  <button onClick={() => setViewDate(todayStr)}
                    className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition">
                    오늘
                  </button>
                )}
              </div>
              <button onClick={() => shiftDate(1)} disabled={isToday}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition disabled:opacity-30">
                ›
              </button>
            </div>

            {/* 기록 추가 버튼 */}
            <div className="flex justify-end mb-3">
              <button onClick={openAdd}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition shadow-sm">
                + 기록 추가
              </button>
            </div>

            {/* 테이블 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-3xl mb-2">📝</p>
                  <p className="text-gray-500 text-sm">이 날의 기록이 없어요</p>
                  <button onClick={openAdd}
                    className="mt-4 px-4 py-2 rounded-xl bg-sky-50 text-sky-500 text-sm font-medium hover:bg-sky-100 transition">
                    첫 기록 추가하기
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">시간</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">분유량</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">수유</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">기저귀</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">메모</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">작성자</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {logs.map(log => (
                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                            {fmtTime(log.recordTime)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {log.formulaAmount != null ? (
                              <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold text-xs">
                                {log.formulaAmount}ml
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {log.breastfed ? (
                              <span className="text-sky-500 font-bold">O</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {log.diaperType && log.diaperType !== 'NONE'
                              ? DIAPER_LABELS[log.diaperType]
                              : <span className="text-gray-300">-</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">
                            {log.memo || <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-gray-400">
                            {log.writerNickname}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => openEdit(log)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition text-xs">
                                수정
                              </button>
                              <button onClick={() => handleDelete(log.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition text-xs">
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* 요약 푸터 */}
                  <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-4 text-xs text-gray-500">
                    <span>총 {logs.length}건</span>
                    <span>
                      분유 합계:&nbsp;
                      <strong className="text-blue-600">
                        {logs.reduce((s, l) => s + (l.formulaAmount ?? 0), 0)}ml
                      </strong>
                    </span>
                    <span>
                      수유:&nbsp;
                      <strong className="text-rose-500">
                        {logs.filter(l => l.breastfed).length}회
                      </strong>
                    </span>
                    <span>
                      기저귀:&nbsp;
                      <strong className="text-yellow-600">
                        {logs.filter(l => l.diaperType && l.diaperType !== 'NONE').length}회
                      </strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* 기록 추가/수정 모달 */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-800">{editId ? '기록 수정' : '기록 추가'}</h3>
                <button onClick={() => setShowForm(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                  ✕
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                {/* 날짜/시간 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>날짜</label>
                    <input type="date" value={form.date}
                      onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>시간</label>
                    <input type="time" value={form.time}
                      onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                      className={inputCls} />
                  </div>
                </div>

                {/* 분유량 */}
                <div>
                  <label className={labelCls}>분유량 (ml)</label>
                  <input type="number" min="0" max="500" step="5"
                    placeholder="미입력 시 빈칸"
                    value={form.formulaAmount}
                    onChange={e => setForm(p => ({ ...p, formulaAmount: e.target.value }))}
                    className={inputCls} />
                </div>

                {/* 수유 */}
                <div className="flex items-center justify-between py-1">
                  <label className="text-sm font-medium text-gray-700">모유 수유</label>
                  <button
                    onClick={() => setForm(p => ({ ...p, breastfed: !p.breastfed }))}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      form.breastfed ? 'bg-rose-400' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      form.breastfed ? 'translate-x-6' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* 기저귀 */}
                <div>
                  <label className={labelCls}>기저귀</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(DIAPER_LABELS).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setForm(p => ({ ...p, diaperType: key }))}
                        className={`py-2 px-3 rounded-xl text-sm text-left border transition ${
                          form.diaperType === key
                            ? 'border-sky-400 bg-sky-50 text-sky-600 font-medium'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 메모 */}
                <div>
                  <label className={labelCls}>메모</label>
                  <textarea
                    rows={2}
                    placeholder="특이사항을 적어주세요"
                    value={form.memo}
                    onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
                    className={inputCls + ' resize-none'}
                  />
                </div>

                {formMsg && (
                  <p className="text-sm text-red-500">{formMsg}</p>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
                  취소
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition disabled:opacity-50">
                  {saving ? '저장 중...' : (editId ? '수정 완료' : '저장')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5';
const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition';
