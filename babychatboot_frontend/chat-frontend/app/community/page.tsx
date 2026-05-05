'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '../lib/axios';
import Header from '../components/Header';

interface Board {
  id: number;
  name: string;
  description: string;
  boardType: string;
}

interface Post {
  id: number;
  title: string;
  authorNickname: string;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  boardName: string;
  boardId: number;
}

interface PageData {
  content: Post[];
  totalPages: number;
  totalElements: number;
  number: number;
}

const BOARD_ICONS: Record<string, string> = {
  '병원추천': '🏥',
  '자유게시판': '💬',
  '육아정보': '📚',
  '고민': '🤔',
  '의학 질문': '🩺',
};

function CommunityPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [communityBoards, setCommunityBoards] = useState<Board[]>([]);
  const [medicalBoards, setMedicalBoards] = useState<Board[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('accessToken'));
    fetchBoards();
  }, []);

  const fetchBoards = async () => {
    try {
      const [comRes, medRes] = await Promise.all([
        api.get('/api/community/boards?type=COMMUNITY'),
        api.get('/api/community/boards?type=MEDICAL'),
      ]);
      setCommunityBoards(comRes.data);
      setMedicalBoards(medRes.data);

      const initId = searchParams.get('boardId');
      const allBoards = [...comRes.data, ...medRes.data];
      const init = initId
        ? allBoards.find((b: Board) => b.id === Number(initId))
        : comRes.data[0];
      if (init) setSelectedBoard(init);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPosts = useCallback(async () => {
    if (!selectedBoard) return;
    setIsLoading(true);
    try {
      const res = await api.get(
        `/api/community/boards/${selectedBoard.id}/posts?page=${currentPage}&size=10`
      );
      setPageData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBoard, currentPage]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleBoardSelect = (board: Board) => {
    setSelectedBoard(board);
    setCurrentPage(0);
    router.replace(`/community?boardId=${board.id}`, { scroll: false });
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '방금 전';
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}시간 전`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const BoardTab = ({ board }: { board: Board }) => (
    <button
      onClick={() => handleBoardSelect(board)}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition border ${
        selectedBoard?.id === board.id
          ? board.boardType === 'MEDICAL'
            ? 'bg-blue-500 text-white border-blue-500'
            : 'bg-pink-500 text-white border-pink-500'
          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
      }`}
    >
      <span>{BOARD_ICONS[board.name] ?? '📌'}</span>
      <span>{board.name}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-16">

        {/* 제목 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">💬 커뮤니티</h1>
          {isLoggedIn && selectedBoard && (
            <Link
              href={`/community/write?boardId=${selectedBoard.id}`}
              className="px-4 py-2 rounded-xl bg-pink-500 text-white text-sm font-semibold hover:bg-pink-600 transition shadow-sm"
            >
              + 글쓰기
            </Link>
          )}
        </div>

        {/* 커뮤니티 게시판 탭 */}
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">커뮤니티</p>
          <div className="flex flex-wrap gap-2">
            {communityBoards.map(b => <BoardTab key={b.id} board={b} />)}
          </div>
        </div>

        {/* 의학 질문 탭 */}
        {medicalBoards.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">의학 상담</p>
            <div className="flex flex-wrap gap-2">
              {medicalBoards.map(b => <BoardTab key={b.id} board={b} />)}
            </div>
          </div>
        )}

        {/* 선택 게시판 정보 */}
        {selectedBoard && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4 flex items-center gap-3">
            <span className="text-2xl">{BOARD_ICONS[selectedBoard.name] ?? '📌'}</span>
            <div>
              <p className="font-bold text-gray-800">{selectedBoard.name}</p>
              <p className="text-xs text-gray-400">{selectedBoard.description}</p>
            </div>
            <span className="ml-auto text-sm text-gray-400">
              총 {pageData?.totalElements ?? 0}개의 글
            </span>
          </div>
        )}

        {/* 게시글 목록 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !pageData || pageData.content.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-3xl mb-2">📝</p>
              <p className="text-gray-500 text-sm mb-4">아직 게시글이 없어요</p>
              {isLoggedIn && selectedBoard && (
                <Link
                  href={`/community/write?boardId=${selectedBoard.id}`}
                  className="inline-block px-4 py-2 rounded-xl bg-pink-50 text-pink-500 text-sm font-medium hover:bg-pink-100 transition"
                >
                  첫 글 작성하기
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* 헤더 */}
              <div className="hidden sm:grid grid-cols-[1fr_80px_50px_50px_80px] px-5 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <span>제목</span>
                <span className="text-center">작성자</span>
                <span className="text-center">댓글</span>
                <span className="text-center">조회</span>
                <span className="text-right">날짜</span>
              </div>

              {/* 게시글 행 */}
              <div className="divide-y divide-gray-50">
                {pageData.content.map((post, idx) => (
                  <Link
                    key={post.id}
                    href={`/community/${post.id}`}
                    className="flex sm:grid sm:grid-cols-[1fr_80px_50px_50px_80px] items-center px-5 py-3.5 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-gray-400 mr-2 hidden sm:inline">
                        {(pageData.number * 10) + idx + 1}
                      </span>
                      <span className="font-medium text-gray-800 group-hover:text-pink-500 transition-colors text-sm truncate">
                        {post.title}
                      </span>
                      {post.commentCount > 0 && (
                        <span className="ml-1.5 text-xs text-pink-400 font-semibold">
                          [{post.commentCount}]
                        </span>
                      )}
                    </div>
                    <span className="hidden sm:block text-center text-xs text-gray-500 truncate">
                      {post.authorNickname}
                    </span>
                    <span className="hidden sm:block text-center text-xs text-gray-400">
                      {post.commentCount}
                    </span>
                    <span className="hidden sm:block text-center text-xs text-gray-400">
                      {post.viewCount}
                    </span>
                    <span className="hidden sm:block text-right text-xs text-gray-400">
                      {fmtDate(post.createdAt)}
                    </span>
                    {/* 모바일용 */}
                    <div className="sm:hidden flex items-center gap-2 ml-auto text-xs text-gray-400 flex-shrink-0">
                      <span>{post.authorNickname}</span>
                      <span>·</span>
                      <span>{fmtDate(post.createdAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>

              {/* 페이지네이션 */}
              {pageData.totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 py-4 border-t border-gray-100">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition"
                  >
                    ‹
                  </button>
                  {Array.from({ length: pageData.totalPages }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      className={`w-8 h-8 rounded-lg text-sm transition ${
                        currentPage === i
                          ? 'bg-pink-500 text-white font-semibold'
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(pageData.totalPages - 1, p + 1))}
                    disabled={currentPage === pageData.totalPages - 1}
                    className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition"
                  >
                    ›
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-400">로딩 중...</div></div>}>
      <CommunityPageContent />
    </Suspense>
  );
}
