'use client';

import { useRef, useState } from 'react';
import api from '../../lib/axios';

interface KnowledgeEntry {
  source: string;
  content: string;
}

const EXAMPLE_SOURCES = [
  '수유 가이드라인', '신생아 수면 패턴', '예방접종 일정', '이유식 시작 시기', '아기 발달 단계',
];

type Tab = 'text' | 'file';

export default function AdminDocumentsPage() {
  const [tab, setTab] = useState<Tab>('text');

  // ── 텍스트 직접 입력 ──
  const [entries, setEntries] = useState<KnowledgeEntry[]>([{ source: '', content: '' }]);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<{ source: string; success: boolean; message: string }[]>([]);

  const addEntry = () => setEntries(prev => [...prev, { source: '', content: '' }]);
  const removeEntry = (i: number) => setEntries(prev => prev.filter((_, idx) => idx !== i));
  const updateEntry = (i: number, field: keyof KnowledgeEntry, value: string) =>
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));

  const handleSubmit = async () => {
    const valid = entries.filter(e => e.source.trim() && e.content.trim());
    if (valid.length === 0) return;
    setSaving(true);
    setResults([]);
    const newResults: typeof results = [];
    for (const entry of valid) {
      try {
        const res = await api.post('/api/admin/knowledge', {
          source: entry.source.trim(),
          content: entry.content.trim(),
        });
        newResults.push({ source: entry.source, success: true, message: res.data.message });
      } catch {
        newResults.push({ source: entry.source, success: false, message: '추가 실패. 다시 시도해주세요.' });
      }
    }
    setResults(newResults);
    setSaving(false);
    setEntries([{ source: '', content: '' }]);
  };

  // ── 파일 업로드 ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileSource, setFileSource] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadSaving, setUploadSaving] = useState(false);
  const [uploadResults, setUploadResults] = useState<{ name: string; success: boolean; message: string }[]>([]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setSelectedFiles(Array.from(e.target.files));
  };

  const removeFile = (i: number) => {
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== i));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setUploadSaving(true);
    setUploadResults([]);
    const newResults: typeof uploadResults = [];

    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append('file', file);
      if (fileSource.trim()) formData.append('source', fileSource.trim());
      try {
        const res = await api.post('/api/admin/knowledge/upload', formData);
        newResults.push({
          name: file.name,
          success: true,
          message: `${res.data.message} (${res.data.chunks}개 청크)`,
        });
      } catch (err: any) {
        newResults.push({
          name: file.name,
          success: false,
          message: err.response?.data?.error ?? '업로드 실패',
        });
      }
    }

    setUploadResults(newResults);
    setUploadSaving(false);
    setSelectedFiles([]);
    setFileSource('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">문서/임베딩 관리</h1>
        <p className="text-sm text-gray-500 mt-1">AI 챗봇 지식 베이스에 새 문서를 추가합니다</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
        <p className="text-sm font-medium text-blue-700 mb-1">임베딩 동작 방식</p>
        <ul className="text-xs text-blue-600 space-y-1">
          <li>• 텍스트는 청킹 설정(챗봇 관리 &gt; rag_chunk_size)에 따라 분할되어 pgvector에 저장됩니다.</li>
          <li>• 저장된 지식은 사용자 질문과 유사도 검색(RAG)을 통해 자동으로 활용됩니다.</li>
          <li>• 파일 업로드는 <strong>.txt / .csv / .md</strong> 텍스트 파일을 지원합니다 (최대 20MB).</li>
          <li>• 한 번 저장된 벡터는 재시작해도 유지됩니다.</li>
        </ul>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('text')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
            tab === 'text' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          텍스트 직접 입력
        </button>
        <button
          onClick={() => setTab('file')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
            tab === 'file' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          파일 업로드
        </button>
      </div>

      {/* ── 텍스트 탭 ── */}
      {tab === 'text' && (
        <>
          <div className="space-y-4">
            {entries.map((entry, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-700">문서 {i + 1}</p>
                  {entries.length > 1 && (
                    <button onClick={() => removeEntry(i)} className="text-xs text-red-400 hover:text-red-600">
                      제거
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">출처 (Source)</label>
                    <input
                      value={entry.source}
                      onChange={e => updateEntry(i, 'source', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-sky-400"
                      placeholder="예: 수유 가이드라인 2024"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {EXAMPLE_SOURCES.map(s => (
                        <button
                          key={s}
                          onClick={() => updateEntry(i, 'source', s)}
                          className="px-2 py-0.5 rounded-lg bg-gray-100 text-xs text-gray-600 hover:bg-sky-100 hover:text-sky-600 transition"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">내용</label>
                    <textarea
                      value={entry.content}
                      onChange={e => updateEntry(i, 'content', e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:border-sky-400 resize-y"
                      placeholder="육아 지식, 의학 정보, 가이드라인 등을 입력하세요..."
                    />
                    <p className="text-xs text-gray-400 mt-1">{entry.content.length}자</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={addEntry}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              + 문서 추가
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || entries.every(e => !e.source || !e.content)}
              className="px-6 py-2 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 disabled:opacity-50 transition"
            >
              {saving ? '임베딩 중...' : '벡터스토어에 저장'}
            </button>
          </div>
          {results.length > 0 && (
            <div className="mt-5 space-y-2">
              {results.map((r, i) => (
                <div key={i} className={`rounded-xl p-3 text-sm flex items-center gap-2 ${r.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  <span>{r.success ? '✓' : '✗'}</span>
                  <span><strong>{r.source}</strong>: {r.message}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── 파일 탭 ── */}
      {tab === 'file' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="space-y-4">
            {/* 파일 선택 */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">파일 선택 (.txt, .csv, .md)</label>
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-sky-300 transition"
                onClick={() => fileInputRef.current?.click()}
              >
                <p className="text-3xl mb-2">📄</p>
                <p className="text-sm text-gray-500">클릭하여 파일 선택</p>
                <p className="text-xs text-gray-400 mt-1">txt, csv, md 파일 지원 · 최대 20MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv,.md,.TXT,.CSV,.MD"
                  multiple
                  onChange={onFileChange}
                  className="hidden"
                />
              </div>
              {selectedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {selectedFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📄</span>
                        <div>
                          <p className="text-sm font-medium text-gray-700">{f.name}</p>
                          <p className="text-xs text-gray-400">{(f.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <button onClick={() => removeFile(i)} className="text-xs text-red-400 hover:text-red-600">
                        제거
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 출처 */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                출처 (Source) <span className="text-gray-400 font-normal">— 비워두면 파일명이 출처로 사용됩니다</span>
              </label>
              <input
                value={fileSource}
                onChange={e => setFileSource(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-sky-400"
                placeholder="예: 수유 가이드라인 2024 (선택)"
              />
            </div>

            <button
              onClick={handleUpload}
              disabled={uploadSaving || selectedFiles.length === 0}
              className="w-full py-2.5 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 disabled:opacity-50 transition"
            >
              {uploadSaving ? '임베딩 중...' : `${selectedFiles.length}개 파일 업로드 & 임베딩`}
            </button>
          </div>

          {uploadResults.length > 0 && (
            <div className="mt-5 space-y-2">
              {uploadResults.map((r, i) => (
                <div key={i} className={`rounded-xl p-3 text-sm flex items-center gap-2 ${r.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  <span>{r.success ? '✓' : '✗'}</span>
                  <span><strong>{r.name}</strong>: {r.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
