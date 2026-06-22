import axiosInstance from './axios';

export const getRenewalSettings = async () => {
  const response = await axiosInstance.get(`/api/billing/renewal-settings?t=${Date.now()}`);
  return response.data;
};

export const verifyRenewal = async (data) => {
  const response = await axiosInstance.post('/api/billing/renewal/verify', data);
  return response.data;
};
