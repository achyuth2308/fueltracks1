import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useContext(AuthContext) || {};
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      const token = localStorage.getItem('token');
      const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

      const socketInstance = io(socketUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
      });

      socketInstance.on('connect', () => {
        console.log('[SOCKET] Connected to WebSocket server');
        setConnected(true);
      });

      socketInstance.on('disconnect', () => {
        console.log('[SOCKET] Disconnected from WebSocket server');
        setConnected(false);
      });

      socketInstance.on('connect_error', (error) => {
        console.error('[SOCKET] Connection error:', error);
        setConnected(false);
      });

      setSocket(socketInstance);

      return () => {
        console.log('[SOCKET] Cleaning up WebSocket connection');
        socketInstance.disconnect();
        setSocket(null);
        setConnected(false);
      };
    } else {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
    }
  }, [isAuthenticated]);

  const joinVehicleRoom = useCallback((vehicleId) => {
    if (socket && connected) {
      console.log(`[SOCKET] Requesting join for vehicle:${vehicleId}`);
      socket.emit('join:vehicle', { vehicleId });
    }
  }, [socket, connected]);

  const leaveVehicleRoom = useCallback((vehicleId) => {
    if (socket && connected) {
      console.log(`[SOCKET] Requesting leave for vehicle:${vehicleId}`);
      socket.emit('leave:vehicle', { vehicleId });
    }
  }, [socket, connected]);

  const joinOrgRoom = useCallback((targetOrgId) => {
    if (socket && connected) {
      console.log(`[SOCKET] Requesting join for org:${targetOrgId}`);
      socket.emit('join:org', { targetOrgId });
    }
  }, [socket, connected]);

  const leaveOrgRoom = useCallback((targetOrgId) => {
    if (socket && connected) {
      console.log(`[SOCKET] Requesting leave for org:${targetOrgId}`);
      socket.emit('leave:org', { targetOrgId });
    }
  }, [socket, connected]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        joinVehicleRoom,
        leaveVehicleRoom,
        joinOrgRoom,
        leaveOrgRoom,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
