'use client';

import { useEffect, useRef, useState } from 'react';
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

const DIAPER_LABELS: Record<string, string> = {
  NONE: '없음', WET: '소변', DIRTY: '대변', BOTH: '소변+대변',
};

export default function AdminDailyLogsPage() {
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [inputValue, setInputValue] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = (p: number, q: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), size: '20' });
    if (q) params.set('search', q);
    api.get(`/api/admin/dailylogs?${params}`)
      .then(res => setPageData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(page, search); }, [page, search]);

  const handleSearchChange = (value: string) => {
    setInputValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(0);
      setSearch(value);
    }, 400);
  };

  const handleDelete = async (logId: number) => {
    if (!confirm('이 일지 기록을 삭제하시겠습니까?')) return;
    await api.delete(`/api/admin/dailylogs/${logId}`);
    load(page, search);
  };

  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">일지 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          전체 {pageData?.totalElements ?? '-'}개의 일지 기록
          {search && ` · "${search}" 검색 결과`}
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* 검색 바 */}
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              value={inputValue}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="아기 이름, 작성자 닉네임, 메모 검색..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-pink-400"
            />
          </div>
          {search && (
            <button
              onClick={() => { setInputValue(''); setSearch(''); setPage(0); }}
              className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-gray-50"
            >
              초기화
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !pageData || pageData.content.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-3xl mb-2">📅</p>
            <p className="text-gray-500">
              {search ? `"${search}"에 해당하는 일지가 없습니다.` : '등록된 일지가 없습니다.'}
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
                      <td className="px-4 py-3 text-center text-xs text-gray-500">
                        {fmtDateTime(log.recordTime)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {log.formulaAmount != null ? (
                          <span className="text-blue-600 font-medium">{log.formulaAmount}</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {log.breastfed === true ? (
                          <span className="text-pink-500 text-base">✓</span>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {log.diaperType && log.diaperType !== 'NONE' ? (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">
                            {DIAPER_LABELS[log.diaperType] ?? log.diaperType}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-gray-500 text-xs">
                        {log.memo ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDelete(log.id)}
                          className="text-xs text-red-400 hover:text-red-600 transition"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pageData.totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 py-4 border-t border-gray-100">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                >
                  ‹
                </button>
                {Array.from({ length: Math.min(pageData.totalPages, 10) }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`w-8 h-8 rounded-lg text-sm ${page === i ? 'bg-pink-500 text-white font-semibold' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(pageData.totalPages - 1, p + 1))}
                  disabled={page === pageData.totalPages - 1}
                  className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                >
                  ›
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
