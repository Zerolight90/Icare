import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
    
      {/* 로고 및 메인 타이틀 */}
      <div className="mb-8 animate-fade-in">
        <span className="text-5xl mb-4 block">👶</span>
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
          똑똑한 육아 비서, <span className="text-pink-500">iCare</span>
        </h1>
        <p className="mt-4 text-lg text-gray-600 max-w-md mx-auto">
          복잡한 육아 기록부터 AI 전문 상담까지,<br />
          유나 아빠 영환 님을 위한 맞춤형 솔루션입니다.
        </p>
      </div>

      {/* 주요 기능 소개 카드 */}
      <div className="grid gap-4 mb-12 w-full max-w-sm">
        <div className="p-4 bg-pink-50 rounded-2xl flex items-center gap-4">
          <span className="text-2xl">💬</span>
          <p className="text-sm font-medium text-gray-700">실시간 AI 육아 고민 상담</p>
        </div>
        <div className="p-4 bg-blue-50 rounded-2xl flex items-center gap-4">
          <span className="text-2xl">📊</span>
          <p className="text-sm font-medium text-gray-700">성장 기록 및 통계 관리</p>
        </div>
      </div>

      {/* 🚀 핵심: 챗봇으로 바로 가기 버튼 */}
      <Link href="/chat" className="w-full max-w-sm bg-pink-500 hover:bg-pink-600 text-white font-bold py-4 rounded-2xl text-lg shadow-lg transform transition active:scale-95">
        지금 상담 시작하기
      </Link>

      <footer className="mt-12 text-gray-400 text-xs">
        © 2026 iCare Project. All rights reserved.
      </footer>
    </div>
  );
}