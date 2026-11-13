import axiosInstance from './axios';

// Organizations
export const getOrgs = async () => {
  const response = await axiosInstance.get(`/api/admin/orgs`);
  return response.data;
};

export const getOrgById = async (id) => {
  const response = await axiosInstance.get(`/api/admin/orgs/${id}`);
  return response.data;
};

export const getOrgResources = async (id) => {
  const response = await axiosInstance.get(`/api/admin/orgs/${id}/resources`);
  return response.data;
};

export const createOrg = async (data) => {
  const response = await axiosInstance.post('/api/admin/orgs', data);
  return response.data;
};

export const getExpiredLicenses = () => axiosInstance.get('/api/admin/billing/expired').then(r => r.data);
export const setVehicleBillingAmount = (data) => axiosInstance.post('/api/admin/billing/set-vehicle-amount', data).then(r => r.data);




export const updateOrg = async (id, data) => {
  const response = await axiosInstance.put(`/api/admin/orgs/${id}`, data);
  return response.data;
};

export const deleteOrg = async (id) => {
  const response = await axiosInstance.delete(`/api/admin/orgs/${id}`);
  return response.data;
};

// Users
export const getUsers = async (params = {}) => {
  const response = await axiosInstance.get(`/api/admin/users`, { params });
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

export const sendUserCredentialsWhatsApp = async (id, data = {}) => {
  const response = await axiosInstance.post(`/api/admin/users/${id}/send-whatsapp-template`, data);
  return response.data;
};

export const getUserVehicles = async (id) => {
  const response = await axiosInstance.get(`/api/admin/users/${id}/vehicles`);
  return response.data;
};

// Groups
export const getGroups = async (params = {}) => {
  const response = await axiosInstance.get(`/api/admin/groups`, { params });
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
  const response = await axiosInstance.get(`/api/admin/dashboard/stats`);
  return response.data;
};

// Audit Logs
export const getAuditLogs = async (params = {}) => {
  const query = new URLSearchParams({ ...params }).toString();
  const response = await axiosInstance.get(`/api/audit?${query}`);
  return response.data;
};

export const getAuditLogById = async (id) => {
  const response = await axiosInstance.get(`/api/audit/${id}`);
  return response.data;
};

export const getAuditStats = async () => {
  const response = await axiosInstance.get(`/api/audit/stats`);
  return response.data;
};

export const impersonateUser = async (id, adminToken = null) => {
  const config = adminToken ? { headers: { Authorization: `Bearer ${adminToken}` } } : {};
  const response = await axiosInstance.post(`/api/admin/users/${id}/impersonate`, {}, config);
  return response.data;
};

// Device Quota
export const getDeviceQuota = async (orgId = null) => {
  const params = orgId ? `?orgId=${orgId}` : ``;
  const response = await axiosInstance.get(`/api/admin/device-quota${params}`);
  return response.data;
};

export const setDeviceLimits = async (orgId, deviceLimits) => {
  const response = await axiosInstance.patch(`/api/admin/orgs/${orgId}/device-limits`, { deviceLimits });
  return response.data;
};

// Renewals
export const getRenewalPlans = async () => {
  const response = await axiosInstance.get(`/api/admin/renewal-plans`);
  return response.data;
};

export const createRenewalPlan = async (data) => {
  const response = await axiosInstance.post('/api/admin/renewal-plans', data);
  return response.data;
};

export const updateRenewalPlan = async (id, data) => {
  const response = await axiosInstance.put(`/api/admin/renewal-plans/${id}`, data);
  return response.data;
};

export const deleteRenewalPlan = async (id) => {
  const response = await axiosInstance.delete(`/api/admin/renewal-plans/${id}`);
  return response.data;
};

export const getRenewalTransactions = async () => {
  const response = await axiosInstance.get(`/api/admin/renewal-transactions`);
  return response.data;
};

// Bulk Onboarding
export const bulkOnboardExcel = async (data) => {
  const response = await axiosInstance.post('/api/admin/onboard/bulk-excel', data);
  return response.data;
};

// Site Notifications
export const getOrgSiteNotifications = async (orgId) => {
  const response = await axiosInstance.get(`/api/admin/orgs/${orgId}/site-notifications`);
  return response.data;
};

export const updateOrgSiteNotifications = async (orgId, data) => {
  const response = await axiosInstance.put(`/api/admin/orgs/${orgId}/site-notifications`, data);
  return response.data;
};

export const createOrgSite = async (orgId, data) => {
  const response = await axiosInstance.post(`/api/admin/orgs/${orgId}/sites`, data);
  return response.data;
};

export const getGeofences = async () => {
  const response = await axiosInstance.get(`/api/admin/geofences`);
  return response.data;
};

export const createGeofence = async (data) => {
  const response = await axiosInstance.post(`/api/admin/geofences`, data);
  return response.data;
};

export const updateGeofence = async (id, data) => {
  const response = await axiosInstance.put(`/api/admin/geofences/${id}`, data);
  return response.data;
};

// Organization Tracks & Routes
export const getOrgTracks = async (orgId) => {
  const response = await axiosInstance.get(`/api/admin/orgs/${orgId}/tracks`);
  return response.data;
};

export const createOrgTrack = async (orgId, data) => {
  const response = await axiosInstance.post(`/api/admin/orgs/${orgId}/tracks`, data);
  return response.data;
};

export const deleteOrgTrack = async (orgId, trackId) => {
  const response = await axiosInstance.delete(`/api/admin/orgs/${orgId}/tracks/${trackId}`);
  return response.data;
};

export const getRoutes = async (params = {}) => {
  const response = await axiosInstance.get(`/api/admin/routes`, { params });
  return response.data;
};

export const createRoute = async (data) => {
  const response = await axiosInstance.post(`/api/admin/routes`, data);
  return response.data;
};

export const deleteRoute = async (id) => {
  const response = await axiosInstance.delete(`/api/admin/routes/${id}`);
  return response.data;
};

export const assignRoute = async (id, vehicleIds) => {
  const response = await axiosInstance.post(`/api/admin/routes/${id}/assign`, { vehicleIds });
  return response.data;
};

export const getRouteVehicles = async (id) => {
  const response = await axiosInstance.get(`/api/admin/routes/${id}/vehicles`);
  return response.data;
};

