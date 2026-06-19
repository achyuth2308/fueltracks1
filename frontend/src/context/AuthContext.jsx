import React, { createContext, useState, useEffect, useCallback } from 'react';
import * as authApi from '../api/authApi';
import { impersonateUser } from '../api/adminApi';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasAdminSession, setHasAdminSession] = useState(!!localStorage.getItem('adminToken'));

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await authApi.getMe();
      if (response.success && response.data.user) {
        setUser(response.data.user);
      } else {
        localStorage.removeItem('token');
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to restore auth session:', err);
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setHasAdminSession(!!localStorage.getItem('adminToken'));
    if (token) {
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, [fetchCurrentUser]);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authApi.login(email, password);
      if (response.success && response.data.accessToken) {
        localStorage.setItem('token', response.data.accessToken);
        setUser(response.data.user);
        return { success: true };
      } else {
        setError(response.error || 'Login failed');
        return { success: false, error: response.error };
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'An error occurred during login';
      setError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authApi.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('adminToken');
      setHasAdminSession(false);
      setUser(null);
      setLoading(false);
    }
  };

  const impersonate = async (userId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await impersonateUser(userId);
      if (response.success && response.data.accessToken) {
        const currentToken = localStorage.getItem('token');
        if (!localStorage.getItem('adminToken')) {
          localStorage.setItem('adminToken', currentToken);
          setHasAdminSession(true);
        }
        localStorage.setItem('token', response.data.accessToken);
        setUser(response.data.user);
        return { success: true };
      } else {
        setError(response.error || 'Impersonation failed');
        return { success: false, error: response.error };
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'An error occurred during impersonation';
      setError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setLoading(false);
    }
  };

  const restoreAdmin = async () => {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) return { success: false, error: 'No admin session found' };

    setLoading(true);
    setError(null);
    try {
      localStorage.setItem('token', adminToken);
      localStorage.removeItem('adminToken');
      setHasAdminSession(false);
      await fetchCurrentUser();
      return { success: true };
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'An error occurred during session restore';
      setError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setLoading(false);
    }
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        logout,
        impersonate,
        restoreAdmin,
        hasAdminSession,
        isAuthenticated,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
