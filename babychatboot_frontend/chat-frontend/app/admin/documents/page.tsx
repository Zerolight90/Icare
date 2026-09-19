'use client';

import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import api from '../../lib/axios';

interface Metadata { title: string; sourceUrl: string; publisher: string; revisedOn: string; minAgeMonths: string; maxAgeMonths: string; jurisdiction: string; }
interface Preview { hash: string; currentVersion: string; duplicate: boolean; active: boolean; chunks: number; characters: number; text: string; metadata: Metadata; }
interface Revision { id: string; title: string; source_url: string; publisher: string; revised_on: string | null; active: boolean; }

export default function AdminDocumentsPage() {
  const [mode, setMode] = useState<'text' | 'file'>('file');
  const [metadata, setMetadata] = useState<Metadata>({ title: '', sourceUrl: '', publisher: '', revisedOn: '', minAgeMonths: '', maxAgeMonths: '', jurisdiction: 'UNSPECIFIED' });
  const [unknownDate, setUnknownDate] = useState(false);
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [replaceApproved, setReplaceApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [versions, setVersions] = useState<Revision[]>([]);
  const invalidate = () => { setPreview(null); setReviewed(false); setReplaceApproved(false); setMessage(''); };
  const update = (key: keyof Metadata, value: string) => { invalidate(); setMetadata(prev => ({ ...prev, [key]: value })); };
  useEffect(() => {
    const controller = new AbortController();
    api.get<Revision[]>('/api/admin/knowledge', { signal: controller.signal }).then(r => setVersions(r.data)).catch(() => {});
    return () => controller.abort();
  }, []);

  async function submit(register: boolean) {
    if (busy || (register && (!preview || !reviewed || (preview.currentVersion && !replaceApproved)))) return;
    if (!metadata.title.trim() || !metadata.sourceUrl.trim() || !metadata.publisher.trim() || (!metadata.revisedOn && !unknownDate)) {
      setMessage('제목·원문 주소·발행기관을 입력하고, 개정일 또는 미확인을 선택해 주세요.'); return;
    }
    if (mode === 'file' && (!file || file.size > 2 * 1024 * 1024)) { setMessage('2MB 이내 파일을 선택해 주세요.'); return; }
    if ((metadata.minAgeMonths === '') !== (metadata.maxAgeMonths === '') || (metadata.minAgeMonths !== '' &&
        (![metadata.minAgeMonths, metadata.maxAgeMonths].every(v => /^\d+$/.test(v) && Number(v) <= 216) || Number(metadata.minAgeMonths) > Number(metadata.maxAgeMonths)))) {
      setMessage('최소·최대 월령을 함께 0~216개월 범위로 입력해 주세요.'); return;
    }
    setBusy(true); setMessage('');
    try {
      const fields = { ...metadata, minAgeMonths: metadata.minAgeMonths === '' ? null : Number(metadata.minAgeMonths), maxAgeMonths: metadata.maxAgeMonths === '' ? null : Number(metadata.maxAgeMonths), reviewedHash: register ? preview?.hash ?? '' : '', expectedVersion: preview?.currentVersion ?? '', replaceApproved };
      const endpoint = '/api/admin/knowledge' + (mode === 'file' ? '/upload' : '') + (register ? '' : '/preview');
      let body: FormData | (typeof fields & { content: string });
      if (mode === 'file') {
        body = new FormData(); body.append('file', file!);
        for (const [key, value] of Object.entries(fields)) body.append(key, value == null ? '' : String(value));
      } else body = { ...fields, content };
      const response = await api.post(endpoint, body);
      if (register) {
        setPreview(null); setReviewed(false); setReplaceApproved(false); setMessage(response.data.message);
        const list = await api.get<Revision[]>('/api/admin/knowledge'); setVersions(list.data);
      } else { setPreview(response.data); setReviewed(false); setReplaceApproved(false); }
    } catch (error) {
      const data = isAxiosError(error) ? error.response?.data : null;
      setMessage(typeof data?.error === 'string' ? data.error : '처리 결과를 확인하지 못했습니다. 목록과 미리보기를 다시 확인해 주세요.');
    } finally { setBusy(false); }
  }

  const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm';
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-gray-800">문서 / 지식 관리</h1>
      <p className="mt-1 text-sm text-gray-500">원문과 추출 결과를 확인한 뒤 챗봇 지식으로 등록합니다.</p></div>
    <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">PDF·DOCX·UTF-8 TXT/MD/CSV를 지원합니다. 파일 2MB, 추출 후 30,000자 이내이며 스캔 PDF는 OCR 후 검토가 필요합니다. 복잡한 표와 그림의 내용이 빠지지 않았는지 확인해 주세요.</p>
    <fieldset disabled={busy} className="space-y-4 rounded-xl border bg-white p-5 disabled:opacity-60">
      <div className="flex gap-4">
        <label><input type="radio" checked={mode === 'file'} onChange={() => { invalidate(); setMode('file'); }} /> 파일</label>
        <label><input type="radio" checked={mode === 'text'} onChange={() => { invalidate(); setMode('text'); }} /> 텍스트</label>
      </div>
      <label className="block">문서 제목<input className={inputClass} maxLength={200} value={metadata.title} onChange={e => update('title', e.target.value)} /></label>
      <label className="block">공식 원문 주소<input type="url" className={inputClass} placeholder="https://" maxLength={2000} value={metadata.sourceUrl} onChange={e => update('sourceUrl', e.target.value)} /></label>
      <label className="block">발행기관<input className={inputClass} maxLength={200} value={metadata.publisher} onChange={e => update('publisher', e.target.value)} /></label>
      <div className="flex flex-wrap gap-4">
        <label>최소 월령<input type="number" min="0" max="216" className={inputClass} value={metadata.minAgeMonths} onChange={e => update('minAgeMonths', e.target.value)} /></label>
        <label>최대 월령<input type="number" min="0" max="216" className={inputClass} value={metadata.maxAgeMonths} onChange={e => update('maxAgeMonths', e.target.value)} /></label>
        <label>적용 지역<select className={inputClass} value={metadata.jurisdiction} onChange={e => update('jurisdiction', e.target.value)}>
          <option value="UNSPECIFIED">미확인</option><option value="KR">국내</option><option value="GLOBAL">국제</option><option value="US">미국</option><option value="UK">영국</option>
        </select></label>
      </div>
      <p className="text-sm text-gray-500">대상 월령이 없는 자료는 아이를 선택한 상담·일과표 분석에서 제외합니다. 여러 연령의 내용이 섞인 문서는 주제·월령별로 검토해 주세요.</p>
      <div className="flex flex-wrap items-end gap-4">
        <label>개정일<input type="date" className={inputClass} disabled={unknownDate} value={metadata.revisedOn} onChange={e => update('revisedOn', e.target.value)} /></label>
        <label><input type="checkbox" checked={unknownDate} onChange={e => { invalidate(); setUnknownDate(e.target.checked); if (e.target.checked) setMetadata(prev => ({ ...prev, revisedOn: '' })); }} /> 개정일 미확인</label>
      </div>
      {mode === 'file' ? <label className="block">파일<input type="file" className="mt-2 block" accept=".pdf,.docx,.txt,.md,.csv" onChange={e => { invalidate(); setFile(e.target.files?.[0] ?? null); }} /></label>
        : <label className="block">원문 내용<textarea className={inputClass} rows={8} maxLength={30000} value={content} onChange={e => { invalidate(); setContent(e.target.value); }} /></label>}
      <button onClick={() => void submit(false)} className="rounded-lg bg-sky-600 px-4 py-2 text-white">{busy ? '처리 중…' : '추출 내용 미리보기'}</button>
    </fieldset>
    {message && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm">{message}</p>}
    {preview && <section className="space-y-3 rounded-xl border bg-white p-5">
      <h2 className="font-semibold">등록 전 검토 · {preview.characters.toLocaleString()}자</h2>
      <p className="text-sm">{preview.metadata.title} · {preview.metadata.publisher} · 개정일 {preview.metadata.revisedOn || '미확인'}</p>
      <p className="text-sm">지역 {preview.metadata.jurisdiction} · 대상 {preview.metadata.minAgeMonths ?? '미확인'}~{preview.metadata.maxAgeMonths ?? '미확인'}개월</p>
      <textarea aria-label="추출된 원문" readOnly value={preview.text} rows={14} className={inputClass} />
      {preview.duplicate ? <p className="text-sm">{preview.active ? '이미 등록된 동일 문서입니다.' : '이미 보관된 이전 버전입니다. 자동으로 다시 활성화하지 않습니다.'}</p> : <>
        <label className="block text-sm"><input type="checkbox" checked={reviewed} disabled={busy} onChange={e => setReviewed(e.target.checked)} /> 원문·출처·추출 결과를 확인했고 이 내용을 등록합니다.</label>
        {preview.currentVersion && <label className="block text-sm"><input type="checkbox" checked={replaceApproved} disabled={busy} onChange={e => setReplaceApproved(e.target.checked)} /> 같은 출처의 현재 문서를 교체합니다. 이전 버전은 보관하고 앞으로의 검색에서 제외합니다.</label>}
        <button disabled={busy || !reviewed || (!!preview.currentVersion && !replaceApproved)} onClick={() => void submit(true)} className="rounded-lg bg-sky-600 px-4 py-2 text-white disabled:opacity-40">검토한 문서 등록</button>
      </>}
    </section>}
    <section><h2 className="mb-3 font-semibold">등록 이력 · 최근 100개</h2>
      {versions.length === 0 && <p className="text-sm text-gray-500">아직 검토 후 등록한 문서가 없습니다.</p>}
      <ul className="space-y-2">{versions.map(version => <li key={version.id} className="rounded-lg border bg-white p-3 text-sm">
        <span className="font-medium">{version.title}</span> · {version.publisher} · {version.revised_on || '개정일 미확인'} · {version.active ? '검색에 사용' : '이전 버전 보관'}
      </li>)}</ul>
    </section>
  </div>;
}
