import { useState, useEffect, useCallback } from 'react';
import * as vehicleApi from '../api/vehicleApi';
import * as adminApi from '../api/adminApi';
import { useSocket } from './useSocket';

export const useVehicles = (initialParams = {}) => {
  const [vehicles, setVehicles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [params, setParams] = useState(initialParams);
  const [pagination, setPagination] = useState({ page: 1, limit: 100, total: 0, totalPages: 1 });

  const { socket } = useSocket();

  const fetchVehicles = useCallback(async (currentParams = params) => {
    setLoading(true);
    try {
      const response = await vehicleApi.getVehicles(currentParams);
      if (response.success) {
        setVehicles(response.data);
        if (response.pagination) {
          setPagination(response.pagination);
        }
        setError(null);
      }
    } catch (err) {
      console.error('Failed to load vehicles:', err);
      setError(err.response?.data?.error || 'Failed to fetch vehicles');
    } finally {
      setLoading(false);
    }
  }, [params]);

  const fetchGroups = useCallback(async () => {
    try {
      const response = await adminApi.getGroups();
      if (response.success) {
        setGroups(response.data);
      }
    } catch (err) {
      console.error('Failed to load groups:', err);
    }
  }, []);

  // Fetch initial data
  useEffect(() => {
    fetchVehicles();
    fetchGroups();
  }, [fetchVehicles, fetchGroups]);

  // Handle Socket.io real-time updates for matching vehicles in the list
  useEffect(() => {
    if (!socket) return;

    const handleFleetUpdate = (data) => {
      // data: { vehicleId, lat, lng, speed, ignition, ... }
      setVehicles((prevVehicles) =>
        prevVehicles.map((vehicle) => {
          if (vehicle.id === data.vehicleId) {
            return {
              ...vehicle,
              lat: data.lat,
              lng: data.lng,
              current_speed: data.speed,
              current_ignition: data.ignition,
              current_fuel: data.fuel !== undefined ? data.fuel : vehicle.current_fuel,
              current_voltage: data.voltage !== undefined ? data.voltage : vehicle.current_voltage,
              is_online: data.is_online !== undefined ? data.is_online : (data.isOnline !== undefined ? data.isOnline : true),
              last_seen: data.deviceTime || new Date().toISOString(),
            };
          }
          return vehicle;
        })
      );
    };

    socket.on('fleet:update', handleFleetUpdate);
    socket.on('location:update', handleFleetUpdate);

    return () => {
      socket.off('fleet:update', handleFleetUpdate);
      socket.off('location:update', handleFleetUpdate);
    };
  }, [socket]);

  const updateParams = useCallback((newParams) => {
    setParams((prev) => {
      const updated = { ...prev, ...newParams };
      fetchVehicles(updated);
      return updated;
    });
  }, [fetchVehicles]);

  return {
    vehicles,
    groups,
    loading,
    error,
    params,
    pagination,
    updateParams,
    refetch: fetchVehicles,
  };
};
