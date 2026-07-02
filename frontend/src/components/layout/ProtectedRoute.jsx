import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * A wrapper for routes that require specific roles.
 * Usage: <Route path="/admin" element={<ProtectedRoute allowedRoles={['superadmin', 'dealer']}><AdminPage /></ProtectedRoute>} />
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // If the user's role is not in the allowed roles, redirect to the dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
