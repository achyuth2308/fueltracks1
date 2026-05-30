import axiosInstance from './axios';

// Organizations
export const getOrgs = async () => {
  const response = await axiosInstance.get('/api/admin/orgs');
  return response.data;
};

export const getOrgById = async (id) => {
  const response = await axiosInstance.get(`/api/admin/orgs/${id}`);
  return response.data;
};

export const createOrg = async (data) => {
  const response = await axiosInstance.post('/api/admin/orgs', data);
  return response.data;
};

export const updateOrg = async (id, data) => {
  const response = await axiosInstance.put(`/api/admin/orgs/${id}`, data);
  return response.data;
};

export const deleteOrg = async (id) => {
  const response = await axiosInstance.delete(`/api/admin/orgs/${id}`);
  return response.data;
};

// Users
export const getUsers = async () => {
  const response = await axiosInstance.get('/api/admin/users');
  return response.data;
};

export const createUser = async (data) => {
  const response = await axiosInstance.post('/api/admin/users', data);
  return response.data;
};

export const updateUser = async (id, data) => {
  const response = await axiosInstance.put(`/api/admin/users/${id}`, data);
  return response.data;
};

export const deleteUser = async (id) => {
  const response = await axiosInstance.delete(`/api/admin/users/${id}`);
  return response.data;
};

// Groups
export const getGroups = async () => {
  const response = await axiosInstance.get('/api/admin/groups');
  return response.data;
};

export const createGroup = async (data) => {
  const response = await axiosInstance.post('/api/admin/groups', data);
  return response.data;
};

export const updateGroup = async (id, data) => {
  const response = await axiosInstance.put(`/api/admin/groups/${id}`, data);
  return response.data;
};

export const deleteGroup = async (id) => {
  const response = await axiosInstance.delete(`/api/admin/groups/${id}`);
  return response.data;
};

// Stats
export const getDashboardStats = async () => {
  const response = await axiosInstance.get('/api/admin/dashboard/stats');
  return response.data;
};
