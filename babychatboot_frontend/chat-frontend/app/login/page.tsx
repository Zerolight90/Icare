"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '../lib/axios'; // 이전에 만든 axios 인터셉터 인스턴스
import { isAxiosError } from 'axios'; // 🟢 TypeScript 에러 방지용 도구 추가

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      // 1. 백엔드 로그인 API 호출
      const response = await api.post('/api/users/login', { email, password });
      
      // 2. 응답에서 토큰 추출 (백엔드 응답 JSON 구조에 따라 .token 또는 .accessToken 등)
      const token = response.data;
      
      if (token) {
        // 3. 브라우저 로컬 스토리지에 토큰 저장 (신분증 발급 완료!)
        localStorage.setItem('accessToken', token);
        
        // 4. 로그인 성공 후 챗봇 메인 페이지로 이동
        window.location.href = '/chat';
      } else {
        setErrorMessage('토큰 발급에 실패했습니다. 관리자에게 문의하세요.');
      }
    } catch (error: unknown) { // 🟢 any 대신 unknown 사용
      // 🟢 axios 에러인지 확인하고, 401(인증 실패) 에러 처리
      if (isAxiosError(error) && error.response?.status === 401) {
        setErrorMessage('이메일 또는 비밀번호가 일치하지 않습니다.');
      } else {
        setErrorMessage('서버와 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-pink-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden p-8">
        
        {/* 헤더 부분 */}
        <div className="text-center mb-8">
          <span className="text-4xl block mb-2">🍼</span>
          <h2 className="text-2xl font-bold text-gray-900">iCare 로그인</h2>
          <p className="text-sm text-gray-500 mt-2">우리아이 스마트 육아 비서에 오신 것을 환영해요!</p>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
              placeholder="이메일을 입력해주세요"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
              placeholder="비밀번호를 입력해주세요"
            />
          </div>

          {/* 🟢 회원가입 연결부 */}
          <p className="mt-6 text-center text-sm text-gray-500">
            계정이 없으신가요?{" "}
            <Link href="/signup" className="text-pink-500 font-bold hover:underline">
              회원가입 하기
            </Link>
          </p>

          {/* 에러 메시지 표시 영역 */}
          {errorMessage && (
            <p className="text-red-500 text-sm text-center font-medium animate-pulse">
              {errorMessage}
            </p>
          )}

          <button 
            type="submit" 
            disabled={isLoading}
            className={`w-full py-3 rounded-xl text-white font-bold text-lg shadow-md transition-all ${
              isLoading ? 'bg-pink-300 cursor-not-allowed' : 'bg-pink-500 hover:bg-pink-600 active:scale-95'
            }`}
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* 회원가입 링크 */}
        <div className="mt-8 text-center border-t border-gray-100 pt-6">
          <p className="text-sm text-gray-600">
            아직 iCare 회원이 아니신가요? <br/>
            <Link href="/register" className="text-pink-500 font-bold hover:underline mt-1 inline-block">
              회원가입하고 무료 상담받기
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}