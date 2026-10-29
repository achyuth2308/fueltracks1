import axiosInstance from './axios';

export const getRecipients = (params = {}) =>
  axiosInstance.get('/api/whatsapp/recipients', { params }).then(r => r.data);

export const createRecipient = (data) =>
  axiosInstance.post('/api/whatsapp/recipients', data).then(r => r.data);

export const updateRecipient = (id, data) =>
  axiosInstance.put(`/api/whatsapp/recipients/${id}`, data).then(r => r.data);

export const deleteRecipient = (id) =>
  axiosInstance.delete(`/api/whatsapp/recipients/${id}`).then(r => r.data);

export const getWhatsAppSettings = (params = {}) =>
  axiosInstance.get('/api/whatsapp/settings', { params }).then(r => r.data);

export const updateWhatsAppSettings = (data) =>
  axiosInstance.put('/api/whatsapp/settings', data).then(r => r.data);

export const getWhatsAppMessages = (params = {}) =>
  axiosInstance.get('/api/whatsapp/messages', { params }).then(r => r.data);

export const retryWhatsAppMessage = (id) =>
  axiosInstance.post(`/api/whatsapp/messages/${id}/retry`).then(r => r.data);

