import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import * as authApi from '../api/authApi';
import { impersonateUser } from '../api/adminApi';
import { setNoDataThresholdHours } from '../utils/markerUtils';

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
  const isSuper = payload.role === 'superadmin';
  return {
    id: payload.userId,
    role: payload.role,
    orgId: isSuper ? 'a0000000-0000-0000-0000-000000000001' : payload.orgId,
    orgType: isSuper ? 'super' : payload.orgType,
    name: payload.name || null,
    email: payload.email || null,
    orgName: isSuper ? 'FuelTracks Platform' : (payload.orgName || null),
    phone: payload.phone || null,
    noDataMinutes: payload.noDataMinutes !== undefined && payload.noDataMinutes !== null ? Number(payload.noDataMinutes) : 30,
    mapProvider: null,
    apiKey: null,
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasAdminSession, setHasAdminSession] = useState(!!(sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken')));

  /**
   * Background refresh of map config. NEVER causes logout.
   * Server restarts / OOM / DB timeouts are silently ignored.
   */
  const refreshMapConfig = useCallback(async () => {
    try {
      const response = await authApi.getMe();
      if (response?.success && response?.data?.user) {
        const u = response.data.user;
        if (u.noDataMinutes !== undefined && u.noDataMinutes !== null) {
          setNoDataThresholdHours(Number(u.noDataMinutes) / 60);
        }
        setUser(prev => {
          const isSuper = u.role === 'superadmin';
          return prev ? {
            ...prev,
            ...u,
            id: u.id || prev.id,
            role: u.role || prev.role,
            name: u.name || prev.name,
            email: u.email || prev.email,
            phone: u.phone || prev.phone,
            orgId: isSuper ? 'a0000000-0000-0000-0000-000000000001' : (u.orgId || prev.orgId),
            orgName: isSuper ? 'FuelTracks Platform' : (u.orgName || prev.orgName),
            orgType: isSuper ? 'super' : (u.orgType || prev.orgType),
            mapProvider: u.mapProvider || prev.mapProvider,
            apiKey: u.apiKey || prev.apiKey,
            noDataMinutes: u.noDataMinutes !== undefined && u.noDataMinutes !== null ? Number(u.noDataMinutes) : prev.noDataMinutes,
          } : prev;
        });
      }
    } catch {
      // Intentionally swallowed - transient errors must never log the user out
    }
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    setHasAdminSession(!!(sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken')));
    if (!token) { setLoading(false); return; }
    const restoredUser = userFromToken(token);
    if (!restoredUser) {
      if (sessionStorage.getItem('token')) sessionStorage.removeItem('token');
      localStorage.removeItem('token');
      setLoading(false);
      return;
    }
    if (restoredUser.noDataMinutes !== undefined && restoredUser.noDataMinutes !== null) {
      setNoDataThresholdHours(Number(restoredUser.noDataMinutes) / 60);
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
        sessionStorage.setItem('activeOrgName', response.data.user.orgName || '');
      localStorage.setItem('token', response.data.accessToken);
        const fromToken = userFromToken(response.data.accessToken);
        const userData = { ...fromToken, ...response.data.user, id: fromToken?.id || response.data.user?.id };
        if (userData.noDataMinutes !== undefined && userData.noDataMinutes !== null) {
          setNoDataThresholdHours(Number(userData.noDataMinutes) / 60);
        }
        setUser(userData);
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
    // Read dealer context from sessionStorage (set when they logged in via a dealer link)
    const activeDealerParam = sessionStorage.getItem('activeDealerParam');
    localStorage.removeItem('token');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('lastDealerParam'); // cleanup old key
    sessionStorage.removeItem('activeDealerParam');
    setHasAdminSession(false);
    setUser(null);
    if (activeDealerParam) {
      // Redirect back to their specific dealer-branded login page
      window.location.href = `/login?dealer=${activeDealerParam}`;
    } else {
      // Redirect to plain FuelTracks login
      window.location.href = '/login';
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
        const fromToken = userFromToken(response.data.accessToken);
        const userData = { ...fromToken, ...response.data.user, id: fromToken?.id || response.data.user?.id };
        if (userData.noDataMinutes !== undefined && userData.noDataMinutes !== null) {
          setNoDataThresholdHours(Number(userData.noDataMinutes) / 60);
        }
        setUser(userData);
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
    const isSwitchedSession = sessionStorage.getItem('isSwitchedSession');
    const adminToken = sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken');
    if (!adminToken) return { success: false, error: 'No admin session found' };
    try {
      if (isSwitchedSession) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('adminToken');
        sessionStorage.removeItem('isSwitchedSession');
      } else {
        localStorage.setItem('token', adminToken);
        localStorage.removeItem('adminToken');
      }
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

const fallbackAuth = {
  user: null,
  loading: true,
  error: null,
  isAuthenticated: false,
  hasAdminSession: false,
  login: async () => ({ success: false, error: 'Auth initializing' }),
  logout: async () => {},
  impersonate: async () => ({ success: false }),
  restoreAdmin: async () => ({ success: false }),
  refreshUser: async () => {}
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  return context || fallbackAuth;
};
