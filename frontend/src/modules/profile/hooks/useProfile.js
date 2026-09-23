import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/profileApi';

export const useProfile = (orgId = null) => {
  const [profile, setProfile] = useState({});
  const [license, setLicense] = useState(null);
  const [dealerStats, setDealerStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getProfile(orgId);
      if (res.success) {
        setProfile(res.profile || {});
        setLicense(res.license || null);
        setDealerStats(res.dealerStats || null);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = async (data) => {
    try {
      const res = await api.updateProfile(data, orgId);
      if (res.success) {
        setProfile(res.profile);
        window.dispatchEvent(new CustomEvent('profile-updated', { detail: res.profile }));
        return { success: true };
      }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message };
    }
  };

  const uploadImage = async (type, file) => {
    try {
      const res = await api.uploadImage(type, file, orgId);
      if (res.success) {
        setProfile(res.profile);
        window.dispatchEvent(new CustomEvent('profile-updated', { detail: res.profile }));
        return { success: true, fileUrl: res.fileUrl };
      }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message };
    }
  };

  const changePassword = async (data) => {
    try {
      const res = await api.changePassword(data, orgId);
      return { success: res.success, message: res.message };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message };
    }
  };

  return {
    profile,
    license,
    dealerStats,
    loading,
    error,
    refetch: fetchProfile,
    updateProfile,
    uploadImage,
    changePassword,
  };
};
