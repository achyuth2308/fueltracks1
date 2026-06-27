import axiosInstance from './axios';

export const login = async (identifier, password) => {
  const response = await axiosInstance.post('/api/auth/login', { identifier, password });
  return response.data;
};

export const logout = async () => {
  const response = await axiosInstance.post('/api/auth/logout');
  return response.data;
};

export const getMe = async () => {
  const response = await axiosInstance.get('/api/auth/me');
  return response.data;
};
