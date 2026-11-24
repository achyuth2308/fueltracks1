import axiosInstance from './axios';

export const getFleetFuelOverview = async () => {
  const response = await axiosInstance.get('/api/fuel/manual/overview');
  return response.data;
};

export const getVehicleFuelConfig = async (vehicleId) => {
  const response = await axiosInstance.get(`/api/fuel/manual/config/${vehicleId}`);
  return response.data;
};

export const saveVehicleFuelConfig = async (vehicleId, configData) => {
  const response = await axiosInstance.post(`/api/fuel/manual/config/${vehicleId}`, configData);
  return response.data;
};

export const getVehicleFuelState = async (vehicleId) => {
  const response = await axiosInstance.get(`/api/fuel/manual/state/${vehicleId}`);
  return response.data;
};

export const submitFuelEntry = async (vehicleId, entryData) => {
  const response = await axiosInstance.post(`/api/fuel/manual/entry/${vehicleId}`, entryData);
  return response.data;
};

export const getFuelEntries = async (vehicleId, params = {}) => {
  const response = await axiosInstance.get(`/api/fuel/manual/entries/${vehicleId}`, { params });
  return response.data;
};

export const getFuelChartData = async (vehicleId, range = '30d') => {
  const response = await axiosInstance.get(`/api/fuel/manual/chart/${vehicleId}`, { params: { range } });
  return response.data;
};
