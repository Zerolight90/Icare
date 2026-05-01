'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '../lib/axios';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    nickname: '',
    role: 'DAD', // 기본값 설정
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.post('/api/users/signup', formData);
      alert("회원가입 성공! 이메일 인증을 진행해주세요.");
      window.location.href = '/login';
    } catch (error) {
      alert("회원가입에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-pink-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 animate-fade-in">
        <div className="text-center mb-8">
          <span className="text-4xl block mb-2">👶</span>
          <h2 className="text-2xl font-bold text-gray-900">iCare 가입하기</h2>
          <p className="text-sm text-gray-500 mt-2">유나 아빠 영환 님, 환영합니다!</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            type="text" placeholder="본명" required
            className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-pink-500"
            onChange={(e) => setFormData({...formData, name: e.target.value})}
          />
          <input 
            type="text" placeholder="닉네임 (상단에 표시될 이름)" required
            className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-pink-500"
            onChange={(e) => setFormData({...formData, nickname: e.target.value})}
          />
          <input 
            type="email" placeholder="이메일" required
            className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-pink-500"
            onChange={(e) => setFormData({...formData, email: e.target.value})}
          />
          <input 
            type="password" placeholder="비밀번호" required
            className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-pink-500"
            onChange={(e) => setFormData({...formData, password: e.target.value})}
          />
          
          <div className="flex gap-4 p-2 bg-gray-50 rounded-xl">
             <label className="flex-1 text-center py-2 rounded-lg cursor-pointer peer-checked:bg-pink-500">
               <input type="radio" name="role" value="DAD" defaultChecked className="hidden" onChange={(e) => setFormData({...formData, role: e.target.value})} />
               <span className={formData.role === 'DAD' ? 'text-pink-500 font-bold' : 'text-gray-400'}>아빠 👨</span>
             </label>
             <label className="flex-1 text-center py-2 rounded-lg cursor-pointer">
               <input type="radio" name="role" value="MOM" className="hidden" onChange={(e) => setFormData({...formData, role: e.target.value})} />
               <span className={formData.role === 'MOM' ? 'text-pink-500 font-bold' : 'text-gray-400'}>엄마 👩</span>
             </label>
          </div>

          <button 
            type="submit" disabled={isLoading}
            className="w-full py-4 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-2xl shadow-lg transition active:scale-95 mt-4"
          >
            {isLoading ? '가입 처리 중...' : '가입 완료'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-pink-500 font-bold hover:underline">로그인 하기</Link>
        </p>
      </div>
    </div>
  );
}