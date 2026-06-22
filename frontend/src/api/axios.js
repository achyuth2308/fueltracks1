import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3005',
  timeout: 10000,
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
  getOrgs: () => axiosInstance.get(`/api/admin/orgs?t=${Date.now()}`).then(res => res.data),
  getUsers: () => axiosInstance.get(`/api/admin/users?t=${Date.now()}`).then(res => res.data),
  getGroups: (params = {}) => {
    return axiosInstance.get('/api/admin/groups', { params: { ...params, t: Date.now() } }).then(res => res.data)
  },
  getDevices: (params = {}) => {
    return axiosInstance.get('/api/admin/devices', { params: { ...params, t: Date.now() } }).then(res => res.data)
  },
  deleteDevice: (id) => axiosInstance.delete(`/api/admin/devices/${id}`).then(res => res.data),
  onboardDevices: (payload) => axiosInstance.post('/api/admin/onboard/devices', payload).then(res => res.data)
};

// Response interceptor: handle 401
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      // Redirect to login if window is available
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
