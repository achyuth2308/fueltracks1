import axiosInstance from './axios';

export const tripApi = {
  list: (params = {}) =>
    axiosInstance.get('/trips', { params }).then(r => r.data.data),

  create: (body) =>
    axiosInstance.post('/trips', body).then(r => r.data.data),

  start: (id, body = {}) =>
    axiosInstance.post(`/trips/${id}/start`, body).then(r => r.data.data),

  end: (id, body = {}) =>
    axiosInstance.post(`/trips/${id}/end`, body).then(r => r.data.data),

  cancel: (id) =>
    axiosInstance.delete(`/trips/${id}`).then(r => r.data.data),

  getOne: (id) =>
    axiosInstance.get(`/trips/${id}`).then(r => r.data.data),

  getActive: (vehicleId) =>
    axiosInstance.get(`/trips/active/${vehicleId}`).then(r => r.data.data),
};
