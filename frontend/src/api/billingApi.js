import axiosInstance from './axios';

export const getRenewalPlans = async () => {
  const response = await axiosInstance.get(`/api/billing/renewal-plans?t=${Date.now()}`);
  return response.data;
};

export const getVehiclePrice = async (vehicleId) => {
  const response = await axiosInstance.get(`/api/billing/vehicle-price/${vehicleId}`);
  return response.data;
};

export const verifyRenewal = async (data) => {
  const response = await axiosInstance.post('/api/billing/renewal/verify', data);
  return response.data;
};
