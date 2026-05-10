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

// 응답 인터셉터: 401이면 토큰 제거 후 로그인 페이지로
api.interceptors.response.use(
  res => res,
  err => {
    if (err?.response?.status === 401 && typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      const skip = ['/login', '/signup', '/admin/login'];
      if (!skip.includes(currentPath)) {
        localStorage.removeItem('accessToken');
        window.location.href = currentPath.startsWith('/admin') ? '/admin/login' : '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;