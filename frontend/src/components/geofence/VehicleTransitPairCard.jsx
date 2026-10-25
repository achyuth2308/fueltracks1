import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Circle, Polyline, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeftRight,
  TrendingUp,
  MapPin,
  Bell,
  Edit3,
  Trash2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Navigation
} from 'lucide-react';
import {
  formatRadius,
  calculateHaversineDistanceMeters
} from '../../utils/geofenceUtils';

// Helper to auto-fit bounds containing both points A and B
const PairMapAutoFitter = ({ latA, lngA, latB, lngB }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
      if (latA && lngA && latB && lngB) {
        try {
          const bounds = L.latLngBounds([
            [latA, lngA],
            [latB, lngB]
          ]);
          map.fitBounds(bounds, { padding: [25, 25], maxZoom: 13, animate: false });
        } catch (_) {}
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [map, latA, lngA, latB, lngB]);
  return null;
};

// Compact sleek pin
const createPairPin = (label, color) => {
  return L.divIcon({
    className: 'pair-pin-marker',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 32px;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      ">
        <svg width="26" height="32" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 0C7.61116 0 0 7.61116 0 17C0 27.5 17 42 17 42C17 42 34 27.5 34 17C34 7.61116 26.3888 0 17 0Z" fill="${color}" stroke="#FFFFFF" stroke-width="2.5"/>
          <circle cx="17" cy="17" r="10" fill="#FFFFFF"/>
        </svg>
        <span style="
          position: absolute;
          top: 5px;
          color: ${color};
          font-size: 11px;
          font-weight: 900;
          font-family: system-ui, sans-serif;
        ">${label}</span>
      </div>
    `,
    iconSize: [26, 32],
    iconAnchor: [13, 32],
    tooltipAnchor: [0, -32]
  });
};

const VehicleTransitPairCard = ({
  vehicle,
  geofenceA,
  geofenceB,
  onEdit,
  onDelete,
  onSwitchPlace,
  onToggleActive,
  isToggling = false
}) => {
  const navigate = useNavigate();

  const latA = parseFloat(geofenceA.center_lat) || 17.385044;
  const lngA = parseFloat(geofenceA.center_lng) || 78.486671;
  const radiusA = Number(geofenceA.radius) || 200;
  const colorA = geofenceA.color || '#10B981'; // Green

  const latB = parseFloat(geofenceB.center_lat) || 17.485044;
  const lngB = parseFloat(geofenceB.center_lng) || 78.586671;
  const radiusB = Number(geofenceB.radius) || 200;
  const colorB = geofenceB.color || '#0284C7'; // Blue

  // Direct distance between both geofences
  const distanceMeters = useMemo(() => {
    return calculateHaversineDistanceMeters(latA, lngA, latB, lngB);
  }, [latA, lngA, latB, lngB]);

  const midpoint = useMemo(() => {
    return [(latA + latB) / 2, (lngA + lngB) / 2];
  }, [latA, lngA, latB, lngB]);

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: '14px',
        border: '1.5px solid #CBD5E1',
        overflow: 'hidden',
        boxShadow: '0 3px 12px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Compact Top Header Strip */}
      <div
        style={{
          background: '#0F172A',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span
            style={{
              background: '#0284C7',
              color: '#FFFFFF',
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '13px',
              flexShrink: 0
            }}
          >
            ⇄
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#FFFFFF', whiteSpace: 'nowrap' }}>
              Two-Way Transit:
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#38BDF8', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              🟢 {geofenceA.name} ⇄ 🔵 {geofenceB.name}
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 800,
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#E2E8F0',
                padding: '1px 6px',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              {formatRadius(distanceMeters)}
            </span>
          </div>
        </div>

        {/* Analytics Shortcut Button */}
        <button
          type="button"
          onClick={() => {
            const vId = vehicle?.id;
            navigate(`/admin/reports/geofence-transit?vehicleId=${vId || ''}&mode=two_way`);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: '#0284C7',
            color: '#FFFFFF',
            border: 'none',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: '0 1px 4px rgba(2, 132, 199, 0.3)',
          }}
        >
          <TrendingUp size={12} />
          <span>Transit Analytics</span>
        </button>
      </div>

      {/* Slim 110px Mini-Map Strip */}
      <div style={{ height: '115px', width: '100%', position: 'relative', background: '#F8FAFC' }}>
        <MapContainer
          center={midpoint}
          zoom={6}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <PairMapAutoFitter latA={latA} lngA={lngA} latB={latB} lngB={lngB} />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Location A Marker & Circle */}
          <Marker position={[latA, lngA]} icon={createPairPin('A', colorA)}>
            <Tooltip permanent direction="top" offset={[0, -32]}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#047857' }}>
                🟢 {geofenceA.name}
              </span>
            </Tooltip>
          </Marker>
          <Circle
            center={[latA, lngA]}
            radius={radiusA}
            pathOptions={{
              color: colorA,
              fillColor: colorA,
              fillOpacity: 0.25,
              weight: 2
            }}
          />

          {/* Location B Marker & Circle */}
          <Marker position={[latB, lngB]} icon={createPairPin('B', colorB)}>
            <Tooltip permanent direction="top" offset={[0, -32]}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#0369A1' }}>
                🔵 {geofenceB.name}
              </span>
            </Tooltip>
          </Marker>
          <Circle
            center={[latB, lngB]}
            radius={radiusB}
            pathOptions={{
              color: colorB,
              fillColor: colorB,
              fillOpacity: 0.25,
              weight: 2
            }}
          />

          {/* Dashed Connecting Line between A and B */}
          <Polyline
            positions={[
              [latA, lngA],
              [latB, lngB]
            ]}
            pathOptions={{
              color: '#0284C7',
              dashArray: '6, 6',
              weight: 2.5,
              opacity: 0.85
            }}
          />

          {/* Midpoint Distance Badge */}
          <Marker position={midpoint} opacity={0}>
            <Tooltip permanent direction="center">
              <div
                style={{
                  background: '#0F172A',
                  color: '#FFFFFF',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontSize: '9px',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  border: '1px solid #FFFFFF'
                }}
              >
                🛣️ {formatRadius(distanceMeters)}
              </div>
            </Tooltip>
          </Marker>
        </MapContainer>
      </div>

      {/* Compact Side-by-Side Detail Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: '8px',
          padding: '10px 12px',
          alignItems: 'center',
          background: '#FFFFFF'
        }}
      >
        {/* Left Box: FROM Site (A) */}
        <div
          style={{
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: '10px',
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            minWidth: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: '#10B981',
                  color: '#FFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '9px'
                }}
              >
                A
              </span>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                FROM
              </span>
            </div>
            <span
              style={{
                fontSize: '9px',
                fontWeight: 700,
                color: geofenceA.is_active ? '#059669' : '#94A3B8',
                background: geofenceA.is_active ? '#DCFCE7' : '#F1F5F9',
                padding: '1px 5px',
                borderRadius: '4px'
              }}
            >
              {geofenceA.is_active ? 'Active' : 'Off'}
            </span>
          </div>

          <div style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {geofenceA.name}
          </div>

          <div style={{ fontSize: '10px', color: '#64748B' }}>
            {formatRadius(radiusA)} circle • {latA.toFixed(3)}, {lngA.toFixed(3)}
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => onSwitchPlace(geofenceA)}
              style={{
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#0F766E',
                fontSize: '9px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Switch
            </button>
            <button
              type="button"
              onClick={() => onEdit(geofenceA)}
              style={{
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#334155',
                fontSize: '9px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(geofenceA.id)}
              style={{
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid #FECACA',
                background: '#FEF2F2',
                color: '#DC2626',
                fontSize: '9px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Unlink
            </button>
          </div>
        </div>

        {/* Center Arrow */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 2px',
            gap: '2px'
          }}
        >
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: '#0284C715',
              border: '1px solid #0284C730',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0284C7'
            }}
          >
            <ArrowLeftRight size={13} />
          </div>
          <span style={{ fontSize: '9px', fontWeight: 800, color: '#0F172A', textAlign: 'center', whiteSpace: 'nowrap' }}>
            {formatRadius(distanceMeters)}
          </span>
        </div>

        {/* Right Box: TO Site (B) */}
        <div
          style={{
            background: '#F0F9FF',
            border: '1px solid #BAE6FD',
            borderRadius: '10px',
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            minWidth: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: '#0284C7',
                  color: '#FFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '9px'
                }}
              >
                B
              </span>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#0369A1', textTransform: 'uppercase' }}>
                TO
              </span>
            </div>
            <span
              style={{
                fontSize: '9px',
                fontWeight: 700,
                color: geofenceB.is_active ? '#0284C7' : '#94A3B8',
                background: geofenceB.is_active ? '#E0F2FE' : '#F1F5F9',
                padding: '1px 5px',
                borderRadius: '4px'
              }}
            >
              {geofenceB.is_active ? 'Active' : 'Off'}
            </span>
          </div>

          <div style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {geofenceB.name}
          </div>

          <div style={{ fontSize: '10px', color: '#64748B' }}>
            {formatRadius(radiusB)} circle • {latB.toFixed(3)}, {lngB.toFixed(3)}
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => onSwitchPlace(geofenceB)}
              style={{
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#0F766E',
                fontSize: '9px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Switch
            </button>
            <button
              type="button"
              onClick={() => onEdit(geofenceB)}
              style={{
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#334155',
                fontSize: '9px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(geofenceB.id)}
              style={{
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid #FECACA',
                background: '#FEF2F2',
                color: '#DC2626',
                fontSize: '9px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Unlink
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VehicleTransitPairCard;
