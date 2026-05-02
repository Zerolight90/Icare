'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '../lib/axios';

type Step = 'info' | 'baby' | 'verify';
type Role = 'DAD' | 'MOM';
type BabyGender = 'M' | 'F' | 'U';

interface FormData {
  name: string;
  nickname: string;
  email: string;
  password: string;
  role: Role;
  birthDate: string;
  phoneNumber: string;
  address: string;
  babyName: string;
  babyGender: BabyGender;
  babyBirthDate: string;
  inviteCode: string;
}

const inputClass =
  'w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all bg-white';

const STEPS: Step[] = ['info', 'baby', 'verify'];

export default function SignupPage() {
  const [step, setStep] = useState<Step>('info');
  const [form, setForm] = useState<FormData>({
    name: '', nickname: '', email: '', password: '',
    role: 'DAD', birthDate: '', phoneNumber: '', address: '',
    babyName: '', babyGender: 'U', babyBirthDate: '', inviteCode: '',
  });
  const [verifyCode, setVerifyCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  // Step 1 완료 → Step 2
  const handleInfoNext = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('baby');
  };

  // Step 2 완료 → 회원가입 API + 인증메일 발송 → Step 3
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        inviteCode: form.inviteCode.trim() || undefined,
      };
      await api.post('/api/users/signup', payload);
      await api.post(`/api/users/send-email?email=${encodeURIComponent(form.email)}`);
      setStep('verify');
    } catch (err: any) {
      const data = err.response?.data;
      setError(typeof data === 'string' ? data : data?.message ?? '회원가입에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: 인증번호 확인
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await api.post(
        `/api/users/verify?email=${encodeURIComponent(form.email)}&code=${verifyCode}`
      );
      alert('이메일 인증이 완료되었습니다! 로그인해주세요.');
      window.location.href = '/login';
    } catch {
      setError('인증번호가 올바르지 않거나 만료되었습니다. (유효시간 3분)');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    try {
      await api.post(`/api/users/send-email?email=${encodeURIComponent(form.email)}`);
      alert('인증번호를 재발송했습니다.');
    } catch {
      setError('재발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="min-h-screen bg-pink-50 flex items-center justify-center p-4 py-12">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8">

        {/* 헤더 */}
        <div className="text-center mb-6">
          <span className="text-4xl block mb-2">👶</span>
          <h2 className="text-2xl font-bold text-gray-900">iCare 가입하기</h2>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center justify-center mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                stepIndex === i
                  ? 'bg-pink-500 text-white shadow-md'
                  : stepIndex > i
                  ? 'bg-pink-200 text-pink-600'
                  : 'bg-gray-100 text-gray-400'
              }`}>{i + 1}</div>
              {i < STEPS.length - 1 && (
                <div className={`w-10 h-0.5 mx-1 transition-colors ${stepIndex > i ? 'bg-pink-300' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* ─── Step 1: 계정 정보 ─── */}
        {step === 'info' && (
          <form onSubmit={handleInfoNext} className="space-y-4">
            <p className="text-sm font-semibold text-gray-500 mb-1">👤 기본 정보</p>

            <input type="text" placeholder="본명" required className={inputClass}
              value={form.name} onChange={e => set('name', e.target.value)} />
            <input type="text" placeholder="닉네임 (화면에 표시될 이름)" required className={inputClass}
              value={form.nickname} onChange={e => set('nickname', e.target.value)} />
            <input type="email" placeholder="이메일" required className={inputClass}
              value={form.email} onChange={e => set('email', e.target.value)} />
            <input type="password" placeholder="비밀번호" required minLength={6} className={inputClass}
              value={form.password} onChange={e => set('password', e.target.value)} />
            <input type="tel" placeholder="전화번호 (010-0000-0000)" required className={inputClass}
              value={form.phoneNumber} onChange={e => set('phoneNumber', e.target.value)} />

            <div>
              <label className="text-sm text-gray-500 mb-1 block">생년월일</label>
              <input type="date" required className={inputClass}
                value={form.birthDate} onChange={e => set('birthDate', e.target.value)} />
            </div>

            <input type="text" placeholder="주소" required className={inputClass}
              value={form.address} onChange={e => set('address', e.target.value)} />

            {/* 역할 선택 */}
            <div className="flex gap-3 p-2 bg-gray-50 rounded-xl">
              {([['DAD', '아빠 👨'], ['MOM', '엄마 👩']] as [Role, string][]).map(([val, label]) => (
                <label key={val}
                  className={`flex-1 text-center py-2.5 rounded-lg cursor-pointer font-semibold transition-colors ${
                    form.role === val ? 'bg-pink-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}>
                  <input type="radio" name="role" value={val} className="hidden"
                    checked={form.role === val} onChange={e => set('role', e.target.value)} />
                  {label}
                </label>
              ))}
            </div>

            <button type="submit"
              className="w-full py-4 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-2xl shadow-lg transition active:scale-95 mt-2">
              다음 →
            </button>
          </form>
        )}

        {/* ─── Step 2: 아기 정보 ─── */}
        {step === 'baby' && (
          <form onSubmit={handleSignup} className="space-y-4">
            <p className="text-sm font-semibold text-gray-500 mb-1">🍼 아기 정보</p>

            <input type="text" placeholder="아기 이름" required className={inputClass}
              value={form.babyName} onChange={e => set('babyName', e.target.value)} />

            <div>
              <label className="text-sm text-gray-500 mb-1 block">아기 생년월일</label>
              <input type="date" required className={inputClass}
                value={form.babyBirthDate} onChange={e => set('babyBirthDate', e.target.value)} />
            </div>

            {/* 아기 성별 */}
            <div className="flex gap-3 p-2 bg-gray-50 rounded-xl">
              {([['M', '남아 👦'], ['F', '여아 👧'], ['U', '미정 🍬']] as [BabyGender, string][]).map(([val, label]) => (
                <label key={val}
                  className={`flex-1 text-center py-2.5 rounded-lg cursor-pointer text-sm font-semibold transition-colors ${
                    form.babyGender === val ? 'bg-pink-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}>
                  <input type="radio" name="babyGender" value={val} className="hidden"
                    checked={form.babyGender === val} onChange={e => set('babyGender', e.target.value)} />
                  {label}
                </label>
              ))}
            </div>

            {/* 배우자 초대코드 (선택) */}
            <div className="pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-2">👫 배우자 초대코드 <span className="text-gray-400">(선택)</span></p>
              <input type="text" placeholder="배우자의 초대코드 6자리" maxLength={6}
                className={inputClass}
                value={form.inviteCode} onChange={e => set('inviteCode', e.target.value.toUpperCase())} />
              <p className="text-xs text-gray-400 mt-1">
                입력하면 같은 가족 그룹으로 묶입니다.
              </p>
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center bg-red-50 rounded-xl py-2 px-3">{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => { setStep('info'); setError(''); }}
                className="flex-1 py-4 border-2 border-pink-200 text-pink-500 font-bold rounded-2xl transition hover:bg-pink-50 active:scale-95">
                ← 이전
              </button>
              <button type="submit" disabled={isLoading}
                className="flex-1 py-4 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-2xl shadow-lg transition active:scale-95 disabled:opacity-50">
                {isLoading ? '처리 중...' : '가입 완료'}
              </button>
            </div>
          </form>
        )}

        {/* ─── Step 3: 이메일 인증 ─── */}
        {step === 'verify' && (
          <form onSubmit={handleVerify} className="space-y-5">
            <div className="text-center py-4 bg-pink-50 rounded-2xl px-4">
              <span className="text-5xl block mb-3">📧</span>
              <p className="text-gray-800 font-semibold">인증 메일을 발송했습니다</p>
              <p className="text-sm text-gray-500 mt-2">
                <span className="text-pink-500 font-bold break-all">{form.email}</span>
                <br />으로 인증번호 6자리를 보내드렸습니다.
              </p>
              <p className="text-xs text-amber-500 mt-2 font-medium">⏱ 유효시간: 3분</p>
            </div>

            <input
              type="text" placeholder="인증번호 6자리" required maxLength={6}
              inputMode="numeric" autoComplete="one-time-code"
              className={`${inputClass} text-center text-2xl tracking-[0.5em] font-mono`}
              value={verifyCode}
              onChange={e => { setVerifyCode(e.target.value.replace(/\D/g, '')); setError(''); }}
            />

            {error && (
              <p className="text-red-500 text-sm text-center bg-red-50 rounded-xl py-2 px-3">{error}</p>
            )}

            <button type="submit" disabled={isLoading || verifyCode.length !== 6}
              className="w-full py-4 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-2xl shadow-lg transition active:scale-95 disabled:opacity-50">
              {isLoading ? '확인 중...' : '인증 완료 ✓'}
            </button>

            <button type="button" onClick={handleResend}
              className="w-full py-2 text-sm text-gray-400 hover:text-pink-500 transition underline-offset-2 hover:underline">
              인증번호가 오지 않나요? 재발송
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-pink-500 font-bold hover:underline">로그인 하기</Link>
        </p>
      </div>
    </div>
  );
}
