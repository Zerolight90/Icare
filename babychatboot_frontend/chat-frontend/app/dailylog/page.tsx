'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import RetrievalSources from '../components/RetrievalSources';
import { useRouter } from 'next/navigation';
import api from '../lib/axios';
import Header from '../components/Header';

import LogEditor from './LogEditor';
import { activities, diaperLabels as DIAPER_LABELS, localDate as localDateStr, napMinutes, durationLabel, type DailyLog, type LogBody, type Activity } from '../lib/daily-log';

interface Baby {
  id: number;
  name: string;
  gender: string;
  birthDate: string;
}

const GENDER_ICON: Record<string, string> = { M: '👦', F: '👧', U: '👶' };

export default function DailyLogPage() {
  const router = useRouter();
  const [babies, setBabies] = useState<Baby[]>([]);
  const [selectedBaby, setSelectedBaby] = useState<Baby | null>(null);
  const [viewDate, setViewDate] = useState('');
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editLog, setEditLog] = useState<DailyLog | null>(null);
  const [initialActivity, setInitialActivity] = useState<Activity>('feeding');
  const [loadError, setLoadError] = useState('');
  const [supportsActivities, setSupportsActivities] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [formMsg, setFormMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // 건강 문진
  const [healthResult, setHealthResult] = useState('');
  const [healthSources, setHealthSources] = useState('[]');
  const healthRequest = useRef(0);
  const logsRequest = useRef(0);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [showHealthPanel, setShowHealthPanel] = useState(false);

  // 다운로드 날짜 범위
  const [dlFrom, setDlFrom] = useState('');
  const [dlTo, setDlTo] = useState('');
  const [showDlPanel, setShowDlPanel] = useState(false);

  const invalidateAnalysis = () => {
    healthRequest.current++;
    setHealthResult(''); setHealthSources('[]');
    setShowHealthPanel(false); setIsCheckingHealth(false);
  };
  const changeDate = (date: string) => {
    logsRequest.current++; invalidateAnalysis(); setLogs([]); setShowForm(false); setViewDate(date);
  };
  const changeBaby = (baby: Baby) => {
    logsRequest.current++; invalidateAnalysis(); setLogs([]); setShowForm(false); setSelectedBaby(baby);
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/login'); return; }
    let active = true;
    const healthGeneration = healthRequest, logGeneration = logsRequest;
    const fetchBabies = async () => {
    try {
      const [res, capabilities] = await Promise.all([api.get('/api/users/profile'), api.get('/api/logs/capabilities').catch(() => null)]);
      if (!active) return;
      setSupportsActivities(capabilities?.data?.foodAndNaps === true);
      const list: Baby[] = res.data.babies ?? [];
      setBabies(list);
      setViewDate(localDateStr()); setDlFrom(localDateStr()); setDlTo(localDateStr());
      if (list.length > 0) setSelectedBaby(list[0]);
    } catch {
      if (active) router.push('/login');
    } finally { if (active) setProfileLoading(false); }
    };
    void fetchBabies();
    return () => { active = false; healthGeneration.current++; logGeneration.current++; };
  }, [router]);

  const fetchLogs = useCallback(async () => {
    if (!selectedBaby || !viewDate) return;
    const request = ++logsRequest.current;
    setIsLoading(true); setLoadError('');
    try {
      const res = await api.get(`/api/logs/${selectedBaby.id}?date=${viewDate}`);
      if (request === logsRequest.current) setLogs(res.data);
    } catch {
      if (request === logsRequest.current) { setLogs([]); setLoadError('기록을 불러오지 못했습니다. 다시 시도해 주세요.'); }
    } finally {
      if (request === logsRequest.current) setIsLoading(false);
    }
  }, [selectedBaby, viewDate]);

  useEffect(() => {
    const generation = logsRequest;
    void fetchLogs();
    return () => { generation.current++; };
  }, [fetchLogs]);

  const openAdd = (activity: Activity = 'feeding') => {
    setEditLog(null); setInitialActivity(activity); setFormMsg(''); setShowForm(true);
  };
  const openEdit = (log: DailyLog) => {
    setEditLog(log); setFormMsg(''); setShowForm(true);
  };
  const handleSave = async (body: LogBody) => {
    if (!selectedBaby || saving) return;
    setSaving(true); invalidateAnalysis(); setFormMsg('');
    const request = logsRequest.current;
    try {
      if (editLog) await api.put(`/api/logs/entry/${editLog.id}`, body);
      else await api.post(`/api/logs/${selectedBaby.id}`, body);
      if (request === logsRequest.current) {
        setShowForm(false);
        if (body.recordTime.slice(0, 10) !== viewDate) changeDate(body.recordTime.slice(0, 10));
        else void fetchLogs();
      }
    } catch (error: unknown) {
      const data = (error as { response?: { data?: unknown } }).response?.data;
      if (request === logsRequest.current) setFormMsg(typeof data === 'string' ? data : '저장에 실패했습니다. 입력 내용을 확인한 후 다시 시도해 주세요.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (logId: number) => {
    if (!confirm('이 기록을 삭제하시겠어요?')) return;
    setSaving(true);
    invalidateAnalysis();
    const request = logsRequest.current;
    try {
      await api.delete(`/api/logs/entry/${logId}`);
      if (request === logsRequest.current) void fetchLogs();
    } catch {
      alert('삭제에 실패했습니다.');
    } finally { setSaving(false); }
  };

  const shiftDate = (delta: number) => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() + delta);
    changeDate(localDateStr(d));
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
    if (!selectedBaby || logs.length === 0 || isLoading || saving) {
      alert('선택한 날짜의 기록을 불러온 뒤 분석할 수 있습니다.');
      return;
    }
    setIsCheckingHealth(true);
    const request = ++healthRequest.current;
    setHealthResult('');
    setHealthSources('[]');
    setShowHealthPanel(true);
    try {
      const res = await api.post(`/api/logs/${selectedBaby.id}/health-check?date=${viewDate}`);
      if (request !== healthRequest.current) return;
      setHealthResult(res.data.result);
      setHealthSources(res.data.retrievalSources ?? '[]');
    } catch {
      if (request === healthRequest.current) setHealthResult('AI 기록 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      if (request === healthRequest.current) setIsCheckingHealth(false);
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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-800">📋 하루 일과표</h1>
          <div className="flex gap-2">
            {selectedBaby && logs.length > 0 && (
              <button
                onClick={handleHealthCheck}
                disabled={isCheckingHealth || isLoading || saving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-sm text-blue-600 hover:bg-blue-100 transition shadow-sm disabled:opacity-50"
              >
                AI 육아 기록 분석
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
                <h3 className="font-semibold text-gray-800 text-sm">AI 육아 기록 분석</h3>
                <span className="text-xs text-gray-400">{selectedBaby?.name} · {viewDate}</span>
              </div>
              <button aria-label="AI 분석 닫기" onClick={() => setShowHealthPanel(false)} className="text-gray-400 hover:text-gray-600 transition">✕</button>
            </div>

            {/* 일일 요약 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{logs.some(l => l.formulaAmount != null) ? totalFormula : '미기록'}</p>
                <p className="text-xs text-blue-400 mt-0.5">기록된 분유(ml)</p>
              </div>
              <div className="bg-rose-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-rose-500">{breastfeedCount || '미기록'}</p>
                <p className="text-xs text-rose-400 mt-0.5">기록된 모유 수유</p>
              </div>
              <div className="bg-yellow-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-yellow-600">{diaperWet || '미기록'}</p>
                <p className="text-xs text-yellow-500 mt-0.5">기록된 소변 기저귀</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{diaperDirty || '미기록'}</p>
                <p className="text-xs text-amber-500 mt-0.5">기록된 대변 기저귀</p>
              </div>
            </div>

            {isCheckingHealth ? (
              <div className="flex items-center gap-3 py-4 text-gray-500 text-sm">
                <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin flex-shrink-0" />
                선택한 날짜의 기록과 참고자료를 확인하고 있습니다...
              </div>
            ) : healthResult ? (
              <div className="prose prose-sm max-w-none text-gray-700 text-sm leading-7
                [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-800 [&_h3]:mt-3 [&_h3]:mb-1
                [&_ul]:pl-5 [&_ul]:space-y-1 [&_li]:text-gray-600
                [&_strong]:text-gray-800 [&_strong]:font-semibold
                [&_p]:my-2">
                <ReactMarkdown skipHtml components={{ a: ({ children }) => <span>{children}</span>, img: () => null }}>{healthResult}</ReactMarkdown>
              </div>
            ) : null}
            {!isCheckingHealth && healthResult && <RetrievalSources value={healthSources} />}
            <p className="mt-3 text-xs text-gray-500">부모가 입력한 일부 기록에 따른 정보 안내입니다. 미기록은 0회나 정상을 뜻하지 않으며, 의료진의 진료를 대신하지 않습니다.</p>
          </div>
        )}

        {/* 다운로드 패널 */}
        {showDlPanel && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">📥 기간 선택 후 다운로드</p>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label htmlFor="export-from" className="text-xs text-gray-500 block mb-1">시작일</label>
                <input id="export-from" type="date" value={dlFrom} onChange={e => setDlFrom(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-sky-400" />
              </div>
              <div>
                <label htmlFor="export-to" className="text-xs text-gray-500 block mb-1">종료일</label>
                <input id="export-to" type="date" value={dlTo} onChange={e => setDlTo(e.target.value)}
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
        {profileLoading && <p role="status" className="py-10 text-center text-slate-600">아이 정보를 불러오고 있어요…</p>}
        {!profileLoading && babies.length === 0 && (
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
                  onClick={() => { if (selectedBaby?.id !== baby.id) changeBaby(baby); }}
                  aria-pressed={selectedBaby?.id === baby.id}
                  disabled={saving}
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
              <button aria-label="이전 날짜" disabled={saving} onClick={() => shiftDate(-1)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition">
                ‹
              </button>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  aria-label="일과 조회 날짜" disabled={saving}
                  value={viewDate}
                  max={todayStr}
                  onChange={e => { if (e.target.value) changeDate(e.target.value); }}
                  className="text-center font-semibold text-gray-800 text-sm focus:outline-none cursor-pointer"
                />
                {!isToday && (
                  <button disabled={saving} onClick={() => changeDate(todayStr)}
                    className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition">
                    오늘
                  </button>
                )}
              </div>
              <button aria-label="다음 날짜" onClick={() => shiftDate(1)} disabled={isToday || saving}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition disabled:opacity-30">
                ›
              </button>
            </div>

            <section aria-label="일과 빠른 기록" className="mb-5">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">무엇을 기록할까요?</h2>
              {!supportsActivities && <p role="status" className="mb-3 text-sm text-slate-600">이유식·낮잠 기록은 아직 준비 중이에요. 이용 가능해지면 새로고침해 주세요.</p>}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {activities.map(activity => <button key={activity.id} onClick={() => openAdd(activity.id)} disabled={saving || !viewDate || (!supportsActivities && (activity.id === 'food' || activity.id === 'nap'))}
                  className="disabled:opacity-50 min-h-14 rounded-xl border border-slate-300 bg-white px-3 py-3 font-semibold text-slate-800 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-sky-700">
                  <span aria-hidden="true">{activity.icon} </span>{activity.label} 기록
                </button>)}
              </div>
            </section>
            <section aria-label="기록 요약" className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold text-slate-800">기록한 일과 한눈에 보기</h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  ['분유', logs.some(log => log.formulaAmount != null) ? `${totalFormula}ml` : '미기록'],
                  ['모유', breastfeedCount ? `${breastfeedCount}회` : '미기록'],
                  ['이유식', logs.some(log => log.solidFoodName) ? `${logs.filter(log => log.solidFoodName).length}회` : '미기록'],
                  ['낮잠', logs.some(log => log.napEndTime) ? durationLabel(logs.reduce((sum, log) => sum + (napMinutes(log) ?? 0), 0)) : '미기록'],
                  ['소변 기저귀', diaperWet ? `${diaperWet}회` : '미기록'],
                  ['대변 기저귀', diaperDirty ? `${diaperDirty}회` : '미기록'],
                ].map(([name, value]) => <div key={name} className="rounded-xl bg-slate-50 p-3"><dt className="text-sm text-slate-600">{name}</dt><dd className="mt-1 text-lg font-bold text-slate-900">{isLoading || loadError ? '—' : value}</dd></div>)}
              </dl>
              <p className="mt-3 text-xs leading-5 text-slate-600">입력한 기록만 합산합니다. 미기록은 0회나 정상을 뜻하지 않아요. 낮잠은 시작 날짜 기준이며 하루 전체 수면시간이 아닙니다.</p>
            </section>
            <section aria-labelledby="timeline-heading" aria-busy={isLoading}>
              <h2 id="timeline-heading" className="mb-3 font-semibold text-slate-800">시간순 기록</h2>
              {isLoading ? <p role="status" className="py-10 text-center text-slate-600">기록을 불러오고 있어요…</p>
                : loadError ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{loadError}<button onClick={() => void fetchLogs()} className="ml-2 min-h-11 underline">다시 불러오기</button></div>
                : logs.length === 0 ? <div className="rounded-2xl bg-white p-8 text-center text-slate-600"><p>이 날의 기록이 없어요</p><p className="mt-2 text-sm">위에서 기록할 일과를 선택해 주세요.</p></div>
                : <ol className="space-y-3">{logs.map(log => <li key={log.id}>
                  <article aria-label={`${fmtTime(log.recordTime)} 기록`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <time dateTime={log.recordTime} className="text-lg font-bold text-slate-900">{fmtTime(log.recordTime)}</time>
                      <div className="flex gap-2">
                        <button disabled={saving} onClick={() => openEdit(log)} aria-label={`${fmtTime(log.recordTime)} 기록 수정`} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-sky-800 hover:bg-sky-50 focus-visible:outline-2">수정</button>
                        <button disabled={saving} onClick={() => handleDelete(log.id)} aria-label={`${fmtTime(log.recordTime)} 기록 삭제`} className="min-h-11 rounded-lg px-3 text-sm text-red-800 hover:bg-red-50 focus-visible:outline-2">삭제</button>
                      </div>
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-2 text-sm text-slate-800">
                      {log.formulaAmount != null && <li className="rounded-lg bg-sky-50 px-3 py-2">분유 {log.formulaAmount}ml</li>}
                      {log.breastfed && <li className="rounded-lg bg-rose-50 px-3 py-2">모유 수유</li>}
                      {log.solidFoodName && <li className="max-w-full break-words rounded-lg bg-orange-50 px-3 py-2">이유식 · {log.solidFoodName} · {log.solidFoodAmount != null ? `${log.solidFoodAmount}g` : '섭취량 미기록'}</li>}
                      {log.napEndTime && <li className="rounded-lg bg-violet-50 px-3 py-2">낮잠 · {fmtTime(log.recordTime)} → {log.napEndTime.slice(0,10) !== log.recordTime.slice(0,10) ? `${log.napEndTime.slice(5,10)} ` : ''}{fmtTime(log.napEndTime)} · {durationLabel(napMinutes(log) ?? 0)}</li>}
                      {log.diaperType && log.diaperType !== 'NONE' && <li className="rounded-lg bg-amber-50 px-3 py-2">기저귀 · {DIAPER_LABELS[log.diaperType]}</li>}
                    </ul>
                    {log.memo && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{log.memo}</p>}
                    <p className="mt-3 text-xs text-slate-500">작성자 {log.writerNickname}</p>
                  </article>
                </li>)}</ol>}
            </section>
          </>
        )}

        {showForm && selectedBaby && <LogEditor log={editLog} date={viewDate} initialActivity={initialActivity}
          babyName={selectedBaby.name} supportsActivities={supportsActivities} saving={saving} error={formMsg} onClose={() => setShowForm(false)} onSave={handleSave} />}
      </div>
    </div>
  );
}
