import axiosInstance from '../../../api/axios';

const BASE_URL = '/api/profile';

export const getProfile = async (orgId = null) => {
  const url = orgId ? `${BASE_URL}?orgId=${orgId}` : BASE_URL;
  const response = await axiosInstance.get(url);
  return response.data;
};

export const updateProfile = async (data, orgId = null) => {
  const url = orgId ? `${BASE_URL}?orgId=${orgId}` : BASE_URL;
  const response = await axiosInstance.put(url, data);
  return response.data;
};

export const getDealers = async () => {
  const response = await axiosInstance.get(`${BASE_URL}/dealers`);
  return response.data;
};

export const changePassword = async (data, orgId = null) => {
  const url = orgId ? `${BASE_URL}/change-password?orgId=${orgId}` : `${BASE_URL}/change-password`;
  const response = await axiosInstance.post(url, data);
  return response.data;
};

export const uploadImage = async (type, file, orgId = null) => {
  const formData = new FormData();
  formData.append(type, file);
  
  const url = orgId ? `${BASE_URL}/${type}?orgId=${orgId}` : `${BASE_URL}/${type}`;
  const response = await axiosInstance.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getAuditHistory = async (orgId = null) => {
  const url = orgId ? `${BASE_URL}/audit?orgId=${orgId}` : `${BASE_URL}/audit`;
  const response = await axiosInstance.get(url);
  return response.data;
};

export const getPublicBranding = async (identifier) => {
  const response = await axiosInstance.get(`${BASE_URL}/public/${identifier}`);
  return response.data;
};
