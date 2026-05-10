'use client';

import { useEffect, useState } from 'react';
import api from '../../lib/axios';

interface Post {
  id: number;
  title: string;
  authorNickname: string;
  boardName: string;
  viewCount: number;
  commentCount: number;
  status: number;
  createdAt: string;
}

interface PageData {
  content: Post[];
  totalPages: number;
  totalElements: number;
  number: number;
}

export default function AdminPostsPage() {
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const load = (p = page) => {
    setLoading(true);
    api.get(`/api/admin/posts?page=${p}&size=20`)
      .then(res => setPageData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]);

  const handleDelete = async (postId: number) => {
    await api.delete(`/api/admin/posts/${postId}`);
    setConfirmDelete(null);
    load();
  };

  const handleRestore = async (postId: number) => {
    await api.patch(`/api/admin/posts/${postId}/restore`);
    load();
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">게시물 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          전체 {pageData?.totalElements ?? '-'}개의 게시글 (삭제 게시글 포함)
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">제목</th>
                    <th className="px-4 py-3 text-left">작성자</th>
                    <th className="px-4 py-3 text-left">게시판</th>
                    <th className="px-4 py-3 text-center">상태</th>
                    <th className="px-4 py-3 text-center">조회</th>
                    <th className="px-4 py-3 text-center">댓글</th>
                    <th className="px-4 py-3 text-right">날짜</th>
                    <th className="px-4 py-3 text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pageData?.content.map(post => (
                    <tr key={post.id} className={`hover:bg-gray-50 transition ${post.status === 0 ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 text-gray-400">{post.id}</td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className={`font-medium truncate ${post.status === 0 ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {post.title}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{post.authorNickname}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                          {post.boardName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          post.status === 1
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-600'
                        }`}>
                          {post.status === 1 ? '활성' : '삭제됨'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">{post.viewCount}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{post.commentCount}</td>
                      <td className="px-4 py-3 text-right text-xs text-gray-400">{fmtDate(post.createdAt)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {post.status === 0 ? (
                            <button
                              onClick={() => handleRestore(post.id)}
                              className="text-xs text-blue-400 hover:text-blue-600 transition"
                            >
                              복구
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(post.id)}
                              className="text-xs text-red-400 hover:text-red-600 transition"
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pageData && pageData.totalPages > 1 && (
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

      {confirmDelete !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-80 shadow-xl">
            <p className="font-bold text-gray-800 mb-2">게시물 숨김 처리</p>
            <p className="text-sm text-gray-500 mb-5">
              이 게시물을 숨김 처리합니다. 관리자 화면에서는 계속 보이며 복구할 수 있습니다.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600"
              >
                숨김
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
