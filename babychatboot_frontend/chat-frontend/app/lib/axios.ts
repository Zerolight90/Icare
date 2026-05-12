import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL, // .env.local에서 읽어옴
  withCredentials: true, // 필요한 경우 쿠키 포함
});

// 요청 인터셉터: 토큰을 헤더에 추가
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터: 401이면 토큰 제거 후 로그인 페이지로 (인증 필요 페이지만)
api.interceptors.response.use(
  res => res,
  err => {
    if (err?.response?.status === 401 && typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      // 인증 없이 접근 가능한 공개 페이지 — 리다이렉트 하지 않음
      const publicPaths = ['/', '/login', '/signup', '/community', '/hospitals', '/chat'];
      const isPublic =
        publicPaths.includes(currentPath) ||
        currentPath.startsWith('/community/') ||
        currentPath.startsWith('/admin/login');
      if (!isPublic) {
        localStorage.removeItem('accessToken');
        window.location.href = currentPath.startsWith('/admin') ? '/admin/login' : '/login';
      } else {
        localStorage.removeItem('accessToken');
      }
    }
    return Promise.reject(err);
  }
);

export default api;