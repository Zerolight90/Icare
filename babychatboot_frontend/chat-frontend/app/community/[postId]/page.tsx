'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import api from '../../lib/axios';
import Header from '../../components/Header';

interface Comment {
  id: number;
  content: string;
  authorNickname: string;
  authorEmail: string;
  createdAt: string;
}

interface PostDetail {
  id: number;
  title: string;
  content: string;
  imageUrls: string | null;
  authorNickname: string;
  authorEmail: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  boardName: string;
  boardId: number;
  comments: Comment[];
}

export default function PostDetailPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.postId as string;

  const [post, setPost] = useState<PostDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [myEmail, setMyEmail] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentMsg, setCommentMsg] = useState('');

  useEffect(() => {
    fetchPost();
    const token = localStorage.getItem('accessToken');
    if (token) {
      api.get('/api/users/me').then(res => setMyEmail(res.data.email ?? '')).catch(() => {});
      // me 엔드포인트가 email을 안 반환하면 profile로 대체
      api.get('/api/users/profile').then(res => setMyEmail(res.data.email ?? '')).catch(() => {});
    }
  }, [postId]);

  const fetchPost = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/api/community/posts/${postId}`);
      setPost(res.data);
    } catch {
      router.push('/community');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('이 게시글을 삭제하시겠어요?')) return;
    try {
      await api.delete(`/api/community/posts/${postId}`);
      router.push(`/community?boardId=${post?.boardId}`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: string } };
      alert(err.response?.data ?? '삭제에 실패했습니다.');
    }
  };

  const handleAddComment = async () => {
    if (!commentInput.trim()) { setCommentMsg('댓글 내용을 입력해주세요.'); return; }
    setCommentSaving(true);
    setCommentMsg('');
    try {
      await api.post(`/api/community/posts/${postId}/comments`, { content: commentInput });
      setCommentInput('');
      fetchPost();
    } catch (e: unknown) {
      const err = e as { response?: { data?: string } };
      setCommentMsg(err.response?.data ?? '댓글 작성에 실패했습니다.');
    } finally {
      setCommentSaving(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('이 댓글을 삭제하시겠어요?')) return;
    try {
      await api.delete(`/api/community/comments/${commentId}`);
      fetchPost();
    } catch {
      alert('댓글 삭제에 실패했습니다.');
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });

  const isLoggedIn = !!localStorage?.getItem?.('accessToken');
  const isAuthor = myEmail && post?.authorEmail === myEmail;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-screen">
          <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!post) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-3xl mx-auto px-4 pt-24 pb-16">

        {/* 뒤로가기 */}
        <Link
          href={`/community?boardId=${post.boardId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition mb-5"
        >
          ‹ {post.boardName}으로 돌아가기
        </Link>

        {/* 게시글 카드 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
          {/* 헤더 */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100">
            <div className="flex items-start gap-3 mb-3">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-500 text-xs font-semibold">
                {post.boardName}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-3 leading-snug">{post.title}</h1>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span className="font-medium text-gray-600">{post.authorNickname}</span>
                <span>·</span>
                <span>{fmtDate(post.createdAt)}</span>
                <span>·</span>
                <span>조회 {post.viewCount}</span>
              </div>
              {isAuthor && (
                <div className="flex gap-2">
                  <Link
                    href={`/community/write?postId=${post.id}&boardId=${post.boardId}`}
                    className="text-xs text-gray-400 hover:text-blue-500 transition px-2 py-1 rounded-lg hover:bg-blue-50"
                  >
                    수정
                  </Link>
                  <button
                    onClick={handleDelete}
                    className="text-xs text-gray-400 hover:text-red-500 transition px-2 py-1 rounded-lg hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 본문 */}
          <div className="px-6 py-6">
            <p className="text-gray-700 leading-8 text-sm whitespace-pre-wrap">{post.content}</p>
            {/* 첨부 이미지 */}
            {post.imageUrls && (() => {
              try {
                const urls: string[] = JSON.parse(post.imageUrls);
                if (urls.length === 0) return null;
                return (
                  <div className="flex flex-wrap gap-3 mt-5 pt-5 border-t border-gray-100">
                    {urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-xl overflow-hidden border border-gray-200 hover:opacity-90 transition">
                        <Image src={url} alt={`첨부이미지${i + 1}`} fill className="object-cover" unoptimized />
                      </a>
                    ))}
                  </div>
                );
              } catch { return null; }
            })()}
          </div>
        </div>

        {/* 댓글 섹션 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">
              댓글 <span className="text-sky-500">{post.comments.length}</span>
            </h2>
          </div>

          {/* 댓글 목록 */}
          {post.comments.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">
              첫 댓글을 남겨보세요 👶
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {post.comments.map(comment => (
                <div key={comment.id} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center text-xs">
                        👤
                      </span>
                      <span className="text-sm font-medium text-gray-700">{comment.authorNickname}</span>
                      <span className="text-xs text-gray-400">{fmtDate(comment.createdAt)}</span>
                    </div>
                    {myEmail === comment.authorEmail && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-xs text-gray-400 hover:text-red-500 transition"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed pl-8 whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* 댓글 입력 */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            {isLoggedIn ? (
              <>
                <div className="flex gap-3">
                  <textarea
                    value={commentInput}
                    onChange={e => setCommentInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                    placeholder="댓글을 입력하세요... (Enter로 전송, Shift+Enter로 줄바꿈)"
                    rows={2}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 resize-none transition"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={commentSaving}
                    className="px-4 py-2 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition disabled:opacity-50 self-end"
                  >
                    {commentSaving ? '...' : '등록'}
                  </button>
                </div>
                {commentMsg && <p className="text-xs text-red-500 mt-2">{commentMsg}</p>}
              </>
            ) : (
              <p className="text-sm text-gray-400 text-center py-2">
                댓글을 작성하려면{' '}
                <Link href="/login" className="text-sky-500 font-medium hover:underline">
                  로그인
                </Link>
                이 필요합니다.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
