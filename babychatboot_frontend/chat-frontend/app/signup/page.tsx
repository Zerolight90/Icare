'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import api from '../lib/axios';

type Step = 'info' | 'baby' | 'verify';
type Role = 'DAD' | 'MOM';
type BabyGender = 'M' | 'F' | 'U';
type BabyCount = 1 | 2 | 3;

interface FormData {
  name: string;
  nickname: string;
  email: string;
  password: string;
  role: Role;
  birthDate: string;
  phoneNumber: string;
  address: string;
  babyCount: BabyCount;
  babyNames: string[];
  babyGenders: BabyGender[];
  babyBirthDate: string;
  inviteCode: string;
}

const inputClass =
  'w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-400 transition-all bg-white';

const STEPS: Step[] = ['info', 'baby', 'verify'];

const BIRTH_TYPES: { value: BabyCount; label: string; icon: string }[] = [
  { value: 1, label: '단태아', icon: '👶' },
  { value: 2, label: '쌍둥이', icon: '👶👶' },
  { value: 3, label: '세쌍둥이', icon: '👶👶👶' },
];

const GENDER_OPTIONS: { value: BabyGender; label: string }[] = [
  { value: 'M', label: '남아 👦' },
  { value: 'F', label: '여아 👧' },
  { value: 'U', label: '미정 🍬' },
];

export default function SignupPage() {
  const [step, setStep] = useState<Step>('info');
  const [form, setForm] = useState<FormData>({
    name: '', nickname: '', email: '', password: '',
    role: 'DAD', birthDate: '', phoneNumber: '', address: '',
    babyCount: 1,
    babyNames: ['', '', ''],
    babyGenders: ['U', 'U', 'U'],
    babyBirthDate: '',
    inviteCode: '',
  });
  const [verifyCode, setVerifyCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const setBabyCount = (count: BabyCount) => {
    setForm(prev => ({ ...prev, babyCount: count }));
    setError('');
  };

  const setBabyName = (index: number, value: string) => {
    setForm(prev => {
      const names = [...prev.babyNames];
      names[index] = value;
      return { ...prev, babyNames: names };
    });
    setError('');
  };

  const setBabyGender = (index: number, value: BabyGender) => {
    setForm(prev => {
      const genders = [...prev.babyGenders];
      genders[index] = value;
      return { ...prev, babyGenders: genders };
    });
    setError('');
  };

  const handleInfoNext = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('baby');
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        babyNames: form.babyNames.slice(0, form.babyCount),
        babyGenders: form.babyGenders.slice(0, form.babyCount),
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
    <div className="min-h-screen bg-sky-50 flex items-center justify-center p-4 py-12">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8">

        {/* 헤더 */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <Image src="/logo.png" alt="iCare 로고" width={72} height={72} className="rounded-2xl" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">iCare 가입하기</h2>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center justify-center mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                stepIndex === i
                  ? 'bg-sky-500 text-white shadow-md'
                  : stepIndex > i
                  ? 'bg-sky-200 text-sky-600'
                  : 'bg-gray-100 text-gray-400'
              }`}>{i + 1}</div>
              {i < STEPS.length - 1 && (
                <div className={`w-10 h-0.5 mx-1 transition-colors ${stepIndex > i ? 'bg-sky-300' : 'bg-gray-200'}`} />
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
                    form.role === val ? 'bg-sky-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}>
                  <input type="radio" name="role" value={val} className="hidden"
                    checked={form.role === val} onChange={e => set('role', e.target.value)} />
                  {label}
                </label>
              ))}
            </div>

            <button type="submit"
              className="w-full py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl shadow-lg transition active:scale-95 mt-2">
              다음 →
            </button>
          </form>
        )}

        {/* ─── Step 2: 아기 정보 ─── */}
        {step === 'baby' && (
          <form onSubmit={handleSignup} className="space-y-4">
            <p className="text-sm font-semibold text-gray-500 mb-1">🍼 아기 정보</p>

            {/* 출생 유형 선택 */}
            <div>
              <label className="text-sm text-gray-500 mb-2 block">출생 유형</label>
              <div className="flex gap-2">
                {BIRTH_TYPES.map(({ value, label, icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBabyCount(value)}
                    className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      form.babyCount === value
                        ? 'border-sky-500 bg-sky-50 text-sky-600 shadow-sm'
                        : 'border-gray-200 text-gray-400 hover:border-sky-300'
                    }`}
                  >
                    <span className="block text-lg mb-0.5">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 아기 생년월일 (공통) */}
            <div>
              <label className="text-sm text-gray-500 mb-1 block">아기 생년월일</label>
              <input type="date" required className={inputClass}
                value={form.babyBirthDate} onChange={e => set('babyBirthDate', e.target.value)} />
            </div>

            {/* 아기별 이름 + 성별 */}
            {Array.from({ length: form.babyCount }).map((_, i) => (
              <div key={i} className="p-4 bg-sky-50 rounded-2xl space-y-3">
                <p className="text-sm font-semibold text-sky-500">
                  {form.babyCount === 1 ? '👶 아기' : `👶 ${i + 1}번째 아기`}
                </p>

                <input
                  type="text"
                  placeholder={`아기 이름${form.babyCount > 1 ? ` (${i + 1}번째)` : ''}`}
                  required
                  className={inputClass}
                  value={form.babyNames[i]}
                  onChange={e => setBabyName(i, e.target.value)}
                />

                <div className="flex gap-2 p-2 bg-white rounded-xl">
                  {GENDER_OPTIONS.map(({ value, label }) => (
                    <label key={value}
                      className={`flex-1 text-center py-2 rounded-lg cursor-pointer text-sm font-semibold transition-colors ${
                        form.babyGenders[i] === value
                          ? 'bg-sky-500 text-white shadow-sm'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}>
                      <input type="radio" name={`babyGender_${i}`} value={value} className="hidden"
                        checked={form.babyGenders[i] === value}
                        onChange={() => setBabyGender(i, value)} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            ))}

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
                className="flex-1 py-4 border-2 border-sky-200 text-sky-500 font-bold rounded-2xl transition hover:bg-sky-50 active:scale-95">
                ← 이전
              </button>
              <button type="submit" disabled={isLoading}
                className="flex-1 py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl shadow-lg transition active:scale-95 disabled:opacity-50">
                {isLoading ? '처리 중...' : '가입 완료'}
              </button>
            </div>
          </form>
        )}

        {/* ─── Step 3: 이메일 인증 ─── */}
        {step === 'verify' && (
          <form onSubmit={handleVerify} className="space-y-5">
            <div className="text-center py-4 bg-sky-50 rounded-2xl px-4">
              <span className="text-5xl block mb-3">📧</span>
              <p className="text-gray-800 font-semibold">인증 메일을 발송했습니다</p>
              <p className="text-sm text-gray-500 mt-2">
                <span className="text-sky-500 font-bold break-all">{form.email}</span>
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
              className="w-full py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl shadow-lg transition active:scale-95 disabled:opacity-50">
              {isLoading ? '확인 중...' : '인증 완료 ✓'}
            </button>

            <button type="button" onClick={handleResend}
              className="w-full py-2 text-sm text-gray-400 hover:text-sky-500 transition underline-offset-2 hover:underline">
              인증번호가 오지 않나요? 재발송
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-sky-500 font-bold hover:underline">로그인 하기</Link>
        </p>
      </div>
    </div>
  );
}
