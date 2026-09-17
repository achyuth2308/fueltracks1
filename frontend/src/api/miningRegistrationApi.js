// ============================================================
// MINING REGISTRATIONS API CLIENT
// ============================================================

import axiosInstance from './axios';

export const miningRegistrationApi = {
  /**
   * Submit registration with multipart form data & upload progress
   */
  submitRegistration: (formData, onUploadProgress) => {
    return axiosInstance.post('/api/mining-registrations', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onUploadProgress(percentCompleted);
        }
      },
    }).then(res => res.data);
  },

  /**
   * Get all registrations with filtering and pagination
   */
  getRegistrations: (params = {}) => {
    return axiosInstance.get('/api/mining-registrations', { params }).then(res => res.data);
  },

  /**
   * Get single registration by ID
   */
  getRegistrationById: (id) => {
    return axiosInstance.get(`/api/mining-registrations/${id}`).then(res => res.data);
  },

  /**
   * Update status & remarks
   */
  updateStatus: (id, payload) => {
    return axiosInstance.patch(`/api/mining-registrations/${id}/status`, payload).then(res => res.data);
  },

  /**
   * Delete registration
   */
  deleteRegistration: (id) => {
    return axiosInstance.delete(`/api/mining-registrations/${id}`).then(res => res.data);
  },

  /**
   * Export CSV blob
   */
  exportCsv: async (params = {}) => {
    const response = await axiosInstance.get('/api/mining-registrations/export/csv', {
      params,
      responseType: 'blob',
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `vehicle_registrations_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
  }
};

export default miningRegistrationApi;
