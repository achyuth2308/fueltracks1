import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  timeout: 30000, // 30s default — history/route calls can return large payloads
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const adminApi = {
  getOrgs: () => axiosInstance.get(`/api/admin/orgs`).then(res => res.data),
  getUsers: () => axiosInstance.get(`/api/admin/users`).then(res => res.data),
  getGroups: (params = {}) => {
    return axiosInstance.get('/api/admin/groups', { params: { ...params } }).then(res => res.data)
  },
  getDevices: (params = {}) => {
    return axiosInstance.get('/api/admin/devices', { params: { ...params } }).then(res => res.data)
  },
  deleteDevice: (id) => axiosInstance.delete(`/api/admin/devices/${id}`).then(res => res.data),
  onboardDevices: (payload) => axiosInstance.post('/api/admin/onboard/devices', payload).then(res => res.data)
};

// Response interceptor: ONLY redirect to login on a genuine 401 from a live server.
// Network errors / timeouts / server crashes must NOT log the user out.
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // error.response is null on network errors (server down, timeout, connection reset).
    // Only act on a real HTTP 401 from the server.
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    // All other errors (500, network, timeout) are returned to the caller
    // so individual pages can handle them gracefully (e.g. show "Failed to load").
    return Promise.reject(error);
  }
);

export default axiosInstance;
