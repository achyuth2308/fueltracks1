import axiosInstance from '../../../api/axios';

const BASE_URL = '/api/profile';

export const getProfile = async () => {
  const response = await axiosInstance.get(BASE_URL);
  return response.data;
};

export const updateProfile = async (data) => {
  const response = await axiosInstance.put(BASE_URL, data);
  return response.data;
};

export const changePassword = async (data) => {
  const response = await axiosInstance.post(`${BASE_URL}/change-password`, data);
  return response.data;
};

export const uploadImage = async (type, file) => {
  const formData = new FormData();
  formData.append(type, file);
  
  const response = await axiosInstance.post(`${BASE_URL}/${type}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getAuditHistory = async () => {
  const response = await axiosInstance.get(`${BASE_URL}/audit`);
  return response.data;
};
