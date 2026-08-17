import axiosInstance from './axios';

export const tripApi = {
  list: (params = {}) =>
    axiosInstance.get('/api/trips', { params }).then(r => r.data.data),

  create: (body) =>
    axiosInstance.post('/api/trips', body).then(r => r.data.data),

  start: (id, body = {}) =>
    axiosInstance.post(`/api/trips/${id}/start`, body).then(r => r.data.data),

  end: (id, body = {}) =>
    axiosInstance.post(`/api/trips/${id}/end`, body).then(r => r.data.data),

  cancel: (id) =>
    axiosInstance.delete(`/api/trips/${id}`).then(r => r.data.data),

  getOne: (id) =>
    axiosInstance.get(`/api/trips/${id}`).then(r => r.data.data),

  getActive: (vehicleId) =>
    axiosInstance.get(`/api/trips/active/${vehicleId}`).then(r => r.data.data),
};
