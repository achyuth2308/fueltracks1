import React, { createContext, useState, useEffect, useCallback } from 'react';
import * as authApi from '../api/authApi';
import { impersonateUser } from '../api/adminApi';

export const AuthContext = createContext(null);

/**
 * Decode JWT payload CLIENT-SIDE with no network call.
 * The server verifies the signature on every API request anyway.
 * This gives us instant session restoration with zero latency.
 */
function decodeJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function userFromToken(token) {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  if (payload.exp && payload.exp * 1000 < Date.now()) return null;
  return {
    id: payload.userId,
    role: payload.role,
    orgId: payload.orgId,
    orgType: payload.orgType,
    name: payload.name || null,
    email: payload.email || null,
    orgName: payload.orgName || null,
    phone: payload.phone || null,
    mapProvider: null,
    apiKey: null,
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasAdminSession, setHasAdminSession] = useState(!!localStorage.getItem('adminToken'));

  /**
   * Background refresh of map config. NEVER causes logout.
   * Server restarts / OOM / DB timeouts are silently ignored.
   */
  const refreshMapConfig = useCallback(async () => {
    try {
      const response = await authApi.getMe();
      if (response?.success && response?.data?.user) {
        setUser(prev => prev ? {
          ...prev,
          mapProvider: response.data.user.mapProvider,
          apiKey: response.data.user.apiKey,
          name: prev.name || response.data.user.name,
          email: prev.email || response.data.user.email,
          orgName: prev.orgName || response.data.user.orgName,
        } : prev);
      }
    } catch {
      // Intentionally swallowed - transient errors must never log the user out
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setHasAdminSession(!!localStorage.getItem('adminToken'));
    if (!token) { setLoading(false); return; }
    const restoredUser = userFromToken(token);
    if (!restoredUser) {
      localStorage.removeItem('token');
      setLoading(false);
      return;
    }
    setUser(restoredUser);
    setLoading(false);
    refreshMapConfig();
  }, [refreshMapConfig]);

  const login = async (identifier, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authApi.login(identifier, password);
      if (response.success && response.data.accessToken) {
        localStorage.setItem('token', response.data.accessToken);
        const fromToken = userFromToken(response.data.accessToken);
        setUser({ ...fromToken, ...response.data.user, id: fromToken?.id || response.data.user?.id });
        return { success: true };
      } else {
        let errMsg = response.error || 'Login failed';
        if (typeof errMsg === 'object') errMsg = errMsg.message || JSON.stringify(errMsg);
        setError(errMsg);
        return { success: false, error: errMsg };
      }
    } catch (err) {
      let errMsg = err.response?.data?.error || err.message || 'An error occurred during login';
      if (typeof errMsg === 'object') errMsg = errMsg.message || JSON.stringify(errMsg);
      setError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try { await authApi.logout(); } catch { }
    localStorage.removeItem('token');
    localStorage.removeItem('adminToken');
    setHasAdminSession(false);
    setUser(null);
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
        const fromToken = userFromToken(response.data.accessToken);
        setUser({ ...fromToken, ...response.data.user, id: fromToken?.id || response.data.user?.id });
        return { success: true };
      } else {
        let errMsg = response.error || 'Impersonation failed';
        if (typeof errMsg === 'object') errMsg = errMsg.message || JSON.stringify(errMsg);
        setError(errMsg);
        return { success: false, error: errMsg };
      }
    } catch (err) {
      let errMsg = err.response?.data?.error || err.message || 'Impersonation error';
      if (typeof errMsg === 'object') errMsg = errMsg.message || JSON.stringify(errMsg);
      setError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setLoading(false);
    }
  };

  const restoreAdmin = async () => {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) return { success: false, error: 'No admin session found' };
    try {
      localStorage.setItem('token', adminToken);
      localStorage.removeItem('adminToken');
      setHasAdminSession(false);
      const restoredUser = userFromToken(adminToken);
      if (restoredUser) { setUser(restoredUser); refreshMapConfig(); return { success: true }; }
      return { success: false, error: 'Invalid admin token' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  return (
    <AuthContext.Provider value={{
      user, loading, error, login, logout, impersonate,
      restoreAdmin, hasAdminSession, isAuthenticated: !!user, refreshUser: refreshMapConfig,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
