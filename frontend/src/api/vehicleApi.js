import axiosInstance from './axios';

export const getVehicles = async (params = {}) => {
  const response = await axiosInstance.get('/api/vehicles', { params });
  return response.data;
};

export const getVehicleById = async (id) => {
  const response = await axiosInstance.get(`/api/vehicles/${id}`);
  return response.data;
};

export const createVehicle = async (data) => {
  const response = await axiosInstance.post('/api/vehicles', data);
  return response.data;
};

export const updateVehicle = async (id, data) => {
  const response = await axiosInstance.put(`/api/vehicles/${id}`, data);
  return response.data;
};

export const deleteVehicle = async (id) => {
  const response = await axiosInstance.delete(`/api/vehicles/${id}`);
  return response.data;
};

export const getVehicleHistory = async (id, params = {}) => {
  const response = await axiosInstance.get(`/api/vehicles/${id}/history`, { params });
  return response.data;
};

export const getVehicleRoute = async (id, params = {}) => {
  const response = await axiosInstance.get(`/api/vehicles/${id}/route`, { params });
  return response.data;
};

export const getVehicleReport = async (id, params = {}) => {
  const response = await axiosInstance.get(`/api/vehicles/${id}/report`, { params });
  return response.data;
};

export const getVehicleAlerts = async (id, params = {}) => {
  const response = await axiosInstance.get(`/api/vehicles/${id}/alerts`, { params });
  return response.data;
};
