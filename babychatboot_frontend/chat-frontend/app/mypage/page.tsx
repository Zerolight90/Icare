'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../lib/axios';
import Header from '../components/Header';

interface BabyDto {
  id: number;
  name: string;
  gender: string;
  birthDate: string;
}

interface Profile {
  email: string;
  name: string;
  nickname: string;
  role: string;
  phoneNumber: string;
  address: string;
  provider: string;
  inviteCode: string;
  babies: BabyDto[];
}


type TabType = 'profile' | 'security' | 'family';

export default function MyPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabType>('profile');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 회원정보 수정 폼
  const [form, setForm] = useState({ name: '', nickname: '', phoneNumber: '', address: '', detailAddress: '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // 비밀번호 변경 폼
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  // 가족 연결 폼
  const [inviteInput, setInviteInput] = useState('');
  const [familyMsg, setFamilyMsg] = useState('');
  const [familySaving, setFamilySaving] = useState(false);

  const scriptLoaded = useRef(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/login'); return; }
    fetchProfile();
    loadDaumScript();
  }, []);

  const loadDaumScript = () => {
    if (scriptLoaded.current || document.getElementById('daum-postcode')) return;
    const script = document.createElement('script');
    script.id = 'daum-postcode';
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.async = true;
    document.head.appendChild(script);
    scriptLoaded.current = true;
  };

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<Profile>('/api/users/profile');
      setProfile(res.data);
      const addr = res.data.address || '';
      const splitIdx = addr.lastIndexOf(' ');
      const base = splitIdx > 0 ? addr.substring(0, splitIdx) : addr;
      const detail = splitIdx > 0 ? addr.substring(splitIdx + 1) : '';
      setForm({
        name: res.data.name || '',
        nickname: res.data.nickname || '',
        phoneNumber: res.data.phoneNumber || '',
        address: base,
        detailAddress: detail,
      });
    } catch {
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const openAddressSearch = () => {
    if (!window.daum?.Postcode) { alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.'); return; }
    new window.daum.Postcode({
      oncomplete: (data: DaumPostcodeResult) => {
        let fullAddress = data.address;
        if (data.addressType === 'R') {
          if (data.bname) fullAddress += ` (${data.bname})`;
          if (data.buildingName) fullAddress += `, ${data.buildingName}`;
        }
        setForm(prev => ({ ...prev, address: fullAddress, detailAddress: '' }));
      },
    }).open();
  };

  const handleProfileSave = async () => {
    setProfileSaving(true);
    setProfileMsg('');
    try {
      const fullAddress = form.detailAddress
        ? `${form.address} ${form.detailAddress}`
        : form.address;
      await api.put('/api/users/profile', {
        name: form.name,
        nickname: form.nickname,
        phoneNumber: form.phoneNumber,
        address: fullAddress,
      });
      setProfileMsg('회원정보가 수정되었습니다.');
      fetchProfile();
    } catch (e: unknown) {
      const err = e as { response?: { data?: string } };
      setProfileMsg(err.response?.data || '저장에 실패했습니다.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (pwForm.newPassword.length < 6) {
      setPwMsg('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    setPwSaving(true);
    setPwMsg('');
    try {
      await api.put('/api/users/password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwMsg('비밀번호가 변경되었습니다.');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e: unknown) {
      const err = e as { response?: { data?: string } };
      setPwMsg(err.response?.data || '비밀번호 변경에 실패했습니다.');
    } finally {
      setPwSaving(false);
    }
  };

  const handleJoinFamily = async () => {
    if (!inviteInput.trim()) { setFamilyMsg('초대 코드를 입력해주세요.'); return; }
    setFamilySaving(true);
    setFamilyMsg('');
    try {
      await api.post('/api/users/family/join', { inviteCode: inviteInput.toUpperCase() });
      setFamilyMsg('가족 그룹에 합류했습니다!');
      setInviteInput('');
      fetchProfile();
    } catch (e: unknown) {
      const err = e as { response?: { data?: string } };
      setFamilyMsg(err.response?.data || '초대 코드가 유효하지 않습니다.');
    } finally {
      setFamilySaving(false);
    }
  };

  const copyInviteCode = () => {
    if (!profile?.inviteCode) return;
    navigator.clipboard.writeText(profile.inviteCode);
    alert('초대 코드가 복사되었습니다!');
  };

  const genderLabel = (g: string) => ({ M: '남아', F: '여아', U: '미정' }[g] ?? g);
  const roleLabel = (r: string) => ({ MOM: '엄마', DAD: '아빠' }[r] ?? r);

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

  const tabs: { key: TabType; label: string }[] = [
    { key: 'profile', label: '회원정보 수정' },
    { key: 'security', label: '보안' },
    { key: 'family', label: '가족 연결' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-16">

        {/* 상단 프로필 요약 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-sky-100 border-2 border-sky-200 flex items-center justify-center text-2xl flex-shrink-0">
            {profile?.role === 'MOM' ? '👩' : '👨'}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg">{profile?.nickname}</p>
            <p className="text-sm text-gray-500">{profile?.email}</p>
            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-600 font-medium">
              {roleLabel(profile?.role ?? '')}
            </span>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100 mb-6">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === t.key
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── 회원정보 수정 탭 ── */}
        {tab === 'profile' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
            <h2 className="font-semibold text-gray-800">회원정보 수정</h2>

            <Field label="이름">
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className={inputCls}
                placeholder="이름을 입력하세요"
              />
            </Field>

            <Field label="닉네임">
              <input
                value={form.nickname}
                onChange={e => setForm(p => ({ ...p, nickname: e.target.value }))}
                className={inputCls}
                placeholder="닉네임을 입력하세요"
              />
            </Field>

            <Field label="전화번호">
              <input
                value={form.phoneNumber}
                onChange={e => setForm(p => ({ ...p, phoneNumber: e.target.value }))}
                className={inputCls}
                placeholder="010-0000-0000"
              />
            </Field>

            <Field label="주소">
              <div className="flex gap-2 mb-2">
                <input
                  value={form.address}
                  readOnly
                  className={inputCls + ' flex-1 bg-gray-50 cursor-default'}
                  placeholder="주소 검색을 눌러주세요"
                />
                <button
                  onClick={openAddressSearch}
                  className="px-3 py-2.5 rounded-xl bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition whitespace-nowrap"
                >
                  주소 검색
                </button>
              </div>
              <input
                value={form.detailAddress}
                onChange={e => setForm(p => ({ ...p, detailAddress: e.target.value }))}
                className={inputCls}
                placeholder="상세 주소를 입력하세요"
              />
            </Field>

            {profileMsg && (
              <p className={`text-sm font-medium ${profileMsg.includes('수정') ? 'text-green-600' : 'text-red-500'}`}>
                {profileMsg}
              </p>
            )}

            <button
              onClick={handleProfileSave}
              disabled={profileSaving}
              className="w-full py-3 rounded-xl bg-sky-500 text-white font-semibold hover:bg-sky-600 transition disabled:opacity-50"
            >
              {profileSaving ? '저장 중...' : '저장하기'}
            </button>
          </div>
        )}

        {/* ── 보안 탭 ── */}
        {tab === 'security' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
            <h2 className="font-semibold text-gray-800">비밀번호 변경</h2>

            {profile?.provider !== 'LOCAL' ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                소셜 로그인({profile?.provider}) 계정은 비밀번호를 변경할 수 없습니다.
              </p>
            ) : (
              <>
                <Field label="현재 비밀번호">
                  <input
                    type="password"
                    value={pwForm.currentPassword}
                    onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))}
                    className={inputCls}
                    placeholder="현재 비밀번호"
                  />
                </Field>

                <Field label="새 비밀번호">
                  <input
                    type="password"
                    value={pwForm.newPassword}
                    onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))}
                    className={inputCls}
                    placeholder="새 비밀번호 (6자 이상)"
                  />
                </Field>

                <Field label="새 비밀번호 확인">
                  <input
                    type="password"
                    value={pwForm.confirmPassword}
                    onChange={e => setPwForm(p => ({ ...p, confirmPassword: e.target.value }))}
                    className={inputCls}
                    placeholder="새 비밀번호 재입력"
                  />
                </Field>

                {pwMsg && (
                  <p className={`text-sm font-medium ${pwMsg.includes('변경') ? 'text-green-600' : 'text-red-500'}`}>
                    {pwMsg}
                  </p>
                )}

                <button
                  onClick={handlePasswordChange}
                  disabled={pwSaving}
                  className="w-full py-3 rounded-xl bg-sky-500 text-white font-semibold hover:bg-sky-600 transition disabled:opacity-50"
                >
                  {pwSaving ? '변경 중...' : '비밀번호 변경'}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── 가족 연결 탭 ── */}
        {tab === 'family' && (
          <div className="space-y-4">
            {/* 현재 가족 초대 코드 */}
            {profile?.inviteCode && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="font-semibold text-gray-800 mb-4">내 가족 초대 코드</h2>
                <p className="text-xs text-gray-400 mb-3">배우자에게 아래 코드를 공유하여 가족으로 연결하세요</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-sky-50 border border-sky-200 rounded-xl py-3 text-center">
                    <span className="text-2xl font-bold text-sky-500 tracking-[0.3em]">
                      {profile.inviteCode}
                    </span>
                  </div>
                  <button
                    onClick={copyInviteCode}
                    className="px-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium transition"
                  >
                    복사
                  </button>
                </div>
              </div>
            )}

            {/* 아이 목록 */}
            {profile?.babies && profile.babies.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="font-semibold text-gray-800 mb-4">우리 아이</h2>
                <div className="space-y-3">
                  {profile.babies.map((baby, idx) => (
                    <div key={baby.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-xl">
                        {baby.gender === 'M' ? '👦' : baby.gender === 'F' ? '👧' : '👶'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">
                          {baby.name}
                          <span className="ml-2 text-xs text-gray-400">({genderLabel(baby.gender)})</span>
                        </p>
                        <p className="text-xs text-gray-500">
                          {idx + 1}번째 아이 · {baby.birthDate}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 가족 합류 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-1">가족 코드로 합류</h2>
              <p className="text-xs text-gray-400 mb-4">배우자의 초대 코드를 입력하면 같은 가족으로 연결됩니다</p>
              <div className="flex gap-2">
                <input
                  value={inviteInput}
                  onChange={e => setInviteInput(e.target.value.toUpperCase())}
                  maxLength={6}
                  className={inputCls + ' flex-1 text-center tracking-widest uppercase font-bold'}
                  placeholder="초대 코드 6자리"
                />
                <button
                  onClick={handleJoinFamily}
                  disabled={familySaving}
                  className="px-4 py-2.5 rounded-xl bg-sky-500 text-white font-semibold text-sm hover:bg-sky-600 transition disabled:opacity-50"
                >
                  {familySaving ? '연결 중...' : '합류'}
                </button>
              </div>
              {familyMsg && (
                <p className={`text-sm font-medium mt-3 ${familyMsg.includes('합류') ? 'text-green-600' : 'text-red-500'}`}>
                  {familyMsg}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 공통 폼 필드 래퍼
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition';
