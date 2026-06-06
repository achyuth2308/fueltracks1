import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/profileApi';

export const useProfile = () => {
  const [profile, setProfile] = useState({});
  const [license, setLicense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getProfile();
      if (res.success) {
        setProfile(res.profile || {});
        setLicense(res.license || null);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = async (data) => {
    try {
      const res = await api.updateProfile(data);
      if (res.success) {
        setProfile(res.profile);
        return { success: true };
      }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message };
    }
  };

  const uploadImage = async (type, file) => {
    try {
      const res = await api.uploadImage(type, file);
      if (res.success) {
        setProfile(res.profile);
        return { success: true };
      }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message };
    }
  };

  const changePassword = async (data) => {
    try {
      const res = await api.changePassword(data);
      return { success: res.success, message: res.message };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message };
    }
  };

  return {
    profile,
    license,
    loading,
    error,
    updateProfile,
    uploadImage,
    changePassword,
    refreshProfile: fetchProfile
  };
};
