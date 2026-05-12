'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import api from '../../lib/axios';
import Header from '../../components/Header';

interface Board { id: number; name: string; boardType: string; }

function WritePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postId = searchParams.get('postId');
  const boardIdParam = searchParams.get('boardId');
  const isEdit = !!postId;

  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>(boardIdParam ?? '');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) { router.push('/login'); return; }
    fetchBoards();
    if (isEdit) fetchPost();
  }, []);

  const fetchBoards = async () => {
    try {
      const res = await api.get('/api/community/boards');
      setBoards(res.data);
      if (!selectedBoardId && res.data.length > 0) setSelectedBoardId(String(res.data[0].id));
    } catch (e) { console.error(e); }
  };

  const fetchPost = async () => {
    try {
      const res = await api.get(`/api/community/posts/${postId}`);
      setTitle(res.data.title);
      setContent(res.data.content);
      setSelectedBoardId(String(res.data.boardId));
      if (res.data.imageUrls) {
        try { setImageUrls(JSON.parse(res.data.imageUrls)); } catch { /* ignore */ }
      }
    } catch { router.push('/community'); }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (imageUrls.length + files.length > 5) { setMsg('이미지는 최대 5장까지 첨부할 수 있습니다.'); return; }

    setUploading(true);
    const newUrls: string[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await api.post('/api/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        newUrls.push(res.data.url);
      } catch {
        setMsg('파일 업로드에 실패했습니다. 이미지 파일(jpg, png, gif, webp)만 가능합니다.');
      }
    }
    setImageUrls(prev => [...prev, ...newUrls]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeImage = (url: string) => setImageUrls(prev => prev.filter(u => u !== url));

  const handleSubmit = async () => {
    if (!title.trim()) { setMsg('제목을 입력해주세요.'); return; }
    if (!content.trim()) { setMsg('내용을 입력해주세요.'); return; }
    if (!selectedBoardId) { setMsg('게시판을 선택해주세요.'); return; }

    setSaving(true);
    setMsg('');
    const imageUrlsJson = imageUrls.length > 0 ? JSON.stringify(imageUrls) : null;
    try {
      if (isEdit) {
        await api.put(`/api/community/posts/${postId}`, { title, content, imageUrls: imageUrlsJson });
        router.push(`/community/${postId}`);
      } else {
        const res = await api.post(`/api/community/boards/${selectedBoardId}/posts`, { title, content, imageUrls: imageUrlsJson });
        router.push(`/community/${res.data.id}`);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: string } };
      setMsg(err.response?.data ?? '저장에 실패했습니다.');
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-3xl mx-auto px-4 pt-24 pb-16">

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">{isEdit ? '게시글 수정' : '글쓰기'}</h1>
          <Link href="/community" className="text-sm text-gray-400 hover:text-gray-600 transition">취소</Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 space-y-5">

            {!isEdit && (
              <div>
                <label className={labelCls}>게시판 선택</label>
                <div className="flex flex-wrap gap-2">
                  {boards.map(b => (
                    <button key={b.id} onClick={() => setSelectedBoardId(String(b.id))}
                      className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition ${
                        selectedBoardId === String(b.id)
                          ? b.boardType === 'MEDICAL' ? 'bg-blue-500 text-white border-blue-500' : 'bg-sky-500 text-white border-sky-500'
                          : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}>
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className={labelCls}>제목</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="제목을 입력하세요" maxLength={100} className={inputCls} />
              <p className="text-xs text-gray-400 mt-1 text-right">{title.length}/100</p>
            </div>

            <div>
              <label className={labelCls}>내용</label>
              <textarea value={content} onChange={e => setContent(e.target.value)}
                placeholder="내용을 입력하세요" rows={12} className={inputCls + ' resize-none'} />
              <p className="text-xs text-gray-400 mt-1 text-right">{content.length}자</p>
            </div>

            {/* 이미지 첨부 */}
            <div>
              <label className={labelCls}>이미지 첨부 (최대 5장)</label>
              <div className="flex flex-wrap gap-3 mb-3">
                {imageUrls.map(url => (
                  <div key={url} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 group">
                    <Image src={url} alt="첨부이미지" fill className="object-cover" unoptimized />
                    <button
                      onClick={() => removeImage(url)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    >✕</button>
                  </div>
                ))}
                {imageUrls.length < 5 && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-sky-400 hover:text-sky-400 transition flex flex-col items-center justify-center gap-1 text-xs"
                  >
                    {uploading ? (
                      <div className="w-4 h-4 border-2 border-sky-300 border-t-sky-500 rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                        </svg>
                        사진 추가
                      </>
                    )}
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
              <p className="text-xs text-gray-400">jpg, png, gif, webp 파일 · 최대 5장</p>
            </div>

            {msg && <p className="text-sm text-red-500">{msg}</p>}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
            <Link href="/community" className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
              취소
            </Link>
            <button onClick={handleSubmit} disabled={saving || uploading}
              className="px-5 py-2.5 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition disabled:opacity-50">
              {saving ? '저장 중...' : isEdit ? '수정 완료' : '게시하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WritePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-400">로딩 중...</div></div>}>
      <WritePageContent />
    </Suspense>
  );
}

const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5';
const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition';
