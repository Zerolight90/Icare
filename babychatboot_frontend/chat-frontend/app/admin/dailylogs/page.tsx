'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '../../lib/axios';

interface LogItem {
  id: number;
  babyName: string;
  userName: string;
  recordTime: string;
  formulaAmount: number | null;
  breastfed: boolean | null;
  diaperType: string | null;
  memo: string | null;
  createdAt: string;
}

interface PageData {
  content: LogItem[];
  totalPages: number;
  totalElements: number;
  number: number;
}

const DIAPER_OPTIONS = [
  { value: '',      label: '전체' },
  { value: 'NONE',  label: '없음' },
  { value: 'WET',   label: '소변' },
  { value: 'DIRTY', label: '대변' },
  { value: 'BOTH',  label: '소변+대변' },
];

const DIAPER_LABELS: Record<string, string> = {
  NONE: '없음', WET: '소변', DIRTY: '대변', BOTH: '소변+대변',
};

const BREASTFED_OPTIONS = [
  { value: 'ALL', label: '전체' },
  { value: 'YES', label: '수유함' },
  { value: 'NO',  label: '미수유' },
];

const SEARCH_TYPE_OPTIONS = [
  { value: 'babyName', label: '아기 이름' },
  { value: 'nickname', label: '닉네임' },
  { value: 'memo',     label: '메모' },
];

export default function AdminDailyLogsPage() {
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  // 기간
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 검색
  const [searchType, setSearchType] = useState('babyName');
  const [keyword, setKeyword] = useState('');

  // 필터
  const [diaperType, setDiaperType] = useState('');
  const [breastfed, setBreastfed] = useState('ALL');

  // 실제 적용된 파라미터 (검색 버튼 누를 때 확정)
  const [applied, setApplied] = useState({
    startDate: '', endDate: '', searchType: 'babyName',
    keyword: '', diaperType: '', breastfed: 'ALL',
  });

  const load = useCallback((p: number, params: typeof applied) => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(p), size: '20' });
    if (params.keyword)   { q.set('searchType', params.searchType); q.set('keyword', params.keyword); }
    if (params.diaperType) q.set('diaperType', params.diaperType);
    if (params.breastfed !== 'ALL') q.set('breastfed', params.breastfed);
    if (params.startDate) q.set('startDate', params.startDate);
    if (params.endDate)   q.set('endDate', params.endDate);
    api.get(`/api/admin/dailylogs?${q}`)
      .then(res => setPageData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(page, applied); }, [page, applied, load]);

  const handleSearch = () => {
    const next = { startDate, endDate, searchType, keyword, diaperType, breastfed };
    setPage(0);
    setApplied(next);
  };

  const handleReset = () => {
    setStartDate(''); setEndDate('');
    setSearchType('babyName'); setKeyword('');
    setDiaperType(''); setBreastfed('ALL');
    setPage(0);
    setApplied({ startDate: '', endDate: '', searchType: 'babyName', keyword: '', diaperType: '', breastfed: 'ALL' });
  };

  const handleDelete = async (logId: number) => {
    if (!confirm('이 일지 기록을 삭제하시겠습니까?')) return;
    await api.delete(`/api/admin/dailylogs/${logId}`);
    load(page, applied);
  };

  const hasFilter = applied.keyword || applied.diaperType || applied.breastfed !== 'ALL' || applied.startDate || applied.endDate;

  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">일지 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          전체 {pageData?.totalElements ?? '-'}개
          {hasFilter && <span className="text-pink-500 ml-1">· 필터 적용 중</span>}
        </p>
      </div>

      {/* 검색 패널 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4 space-y-4">
        {/* 기간 */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">기간 설정</p>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-400" />
            <span className="text-gray-400">~</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-400" />
          </div>
        </div>

        {/* 구분선 */}
        <div className="border-t border-gray-100" />

        {/* 검색 + 필터 */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">검색 및 필터</p>
          <div className="flex flex-wrap gap-2">
            {/* 검색 타입 + 키워드 */}
            <select value={searchType} onChange={e => setSearchType(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-pink-400">
              {SEARCH_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input
              type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="검색어 입력..."
              className="flex-1 min-w-36 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-400"
            />

            {/* 기저귀 */}
            <select value={diaperType} onChange={e => setDiaperType(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-pink-400">
              {DIAPER_OPTIONS.map(o => <option key={o.value} value={o.value}>기저귀: {o.label}</option>)}
            </select>

            {/* 수유 */}
            <select value={breastfed} onChange={e => setBreastfed(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-pink-400">
              {BREASTFED_OPTIONS.map(o => <option key={o.value} value={o.value}>모유: {o.label}</option>)}
            </select>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSearch}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-pink-500 text-white text-sm font-medium hover:bg-pink-600 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            검색
          </button>
          {hasFilter && (
            <button onClick={handleReset}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition">
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* 결과 테이블 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !pageData || pageData.content.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-3xl mb-2">📅</p>
            <p className="text-gray-500 text-sm">
              {hasFilter ? '조건에 맞는 일지가 없습니다.' : '등록된 일지가 없습니다.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">아기</th>
                    <th className="px-4 py-3 text-left">작성자</th>
                    <th className="px-4 py-3 text-center">기록 시간</th>
                    <th className="px-4 py-3 text-center">분유(ml)</th>
                    <th className="px-4 py-3 text-center">모유</th>
                    <th className="px-4 py-3 text-center">기저귀</th>
                    <th className="px-4 py-3 text-left">메모</th>
                    <th className="px-4 py-3 text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pageData.content.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-medium text-gray-800">{log.babyName}</td>
                      <td className="px-4 py-3 text-gray-500">{log.userName}</td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">{fmtDateTime(log.recordTime)}</td>
                      <td className="px-4 py-3 text-center">
                        {log.formulaAmount != null
                          ? <span className="text-blue-600 font-medium">{log.formulaAmount}</span>
                          : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {log.breastfed === true
                          ? <span className="text-pink-500 text-base">✓</span>
                          : <span className="text-gray-300 text-xs">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {log.diaperType && log.diaperType !== 'NONE'
                          ? <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">
                              {DIAPER_LABELS[log.diaperType] ?? log.diaperType}
                            </span>
                          : <span className="text-gray-300 text-xs">-</span>}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-gray-500 text-xs">{log.memo ?? '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleDelete(log.id)}
                          className="text-xs text-red-400 hover:text-red-600 transition">삭제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pageData.totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 py-4 border-t border-gray-100">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30">‹</button>
                {Array.from({ length: Math.min(pageData.totalPages, 10) }, (_, i) => (
                  <button key={i} onClick={() => setPage(i)}
                    className={`w-8 h-8 rounded-lg text-sm ${page === i ? 'bg-pink-500 text-white font-semibold' : 'text-gray-500 hover:bg-gray-100'}`}>
                    {i + 1}
                  </button>
                ))}
                <button onClick={() => setPage(p => Math.min(pageData.totalPages - 1, p + 1))}
                  disabled={page === pageData.totalPages - 1}
                  className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30">›</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
