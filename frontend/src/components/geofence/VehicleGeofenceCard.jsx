import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Circle, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Shield, Edit3, Trash2, Bell, CheckCircle2, XCircle,
  Maximize2, Radio, MapPin, ArrowRightLeft
} from 'lucide-react';
import {
  normalizeCoordinates,
  calculatePolygonAreaM2,
  calculateCircleAreaM2,
  formatArea,
  formatRadius,
  getPolygonCentroid
} from '../../utils/geofenceUtils';

// Helper component to auto-center & fit the mini-map to the geofence geometry
const MiniMapAutoFitter = ({ type, center, radius, points }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    try {
      if (type === 'circle' && center?.lat && center?.lng) {
        const circleBounds = L.latLng(center.lat, center.lng).toBounds((radius || 200) * 2.2);
        map.fitBounds(circleBounds, { padding: [10, 10], animate: false });
      } else if (type === 'polygon' && points && points.length >= 2) {
        const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [15, 15], animate: false });
      } else if (center?.lat && center?.lng) {
        map.setView([center.lat, center.lng], 14, { animate: false });
      }
    } catch (_) {}
  }, [map, type, center, radius, points]);

  return null;
};

const VehicleGeofenceCard = ({
  geofence,
  onEdit,
  onDelete,
  onSwitchPlace,
  onToggleActive,
  isToggling = false,
}) => {
  const isCircle = geofence.type === 'circle';
  const color = geofence.color || '#3B82F6';

  const normalizedPoints = useMemo(() => {
    if (!isCircle && geofence.coordinates) {
      return normalizeCoordinates(geofence.coordinates);
    }
    return [];
  }, [isCircle, geofence.coordinates]);

  const center = useMemo(() => {
    if (isCircle && geofence.center_lat && geofence.center_lng) {
      return { lat: parseFloat(geofence.center_lat), lng: parseFloat(geofence.center_lng) };
    }
    if (!isCircle && normalizedPoints.length > 0) {
      return getPolygonCentroid(normalizedPoints);
    }
    return { lat: 17.207174, lng: 78.314323 };
  }, [isCircle, geofence.center_lat, geofence.center_lng, normalizedPoints]);

  const areaText = useMemo(() => {
    if (isCircle) {
      return formatArea(calculateCircleAreaM2(geofence.radius || 200));
    }
    return formatArea(calculatePolygonAreaM2(normalizedPoints));
  }, [isCircle, geofence.radius, normalizedPoints]);

  const radiusText = useMemo(() => {
    if (isCircle && geofence.radius) {
      return formatRadius(geofence.radius);
    }
    return null;
  }, [isCircle, geofence.radius]);

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s ease',
      }}
      className="hover:shadow-md"
    >
      {/* Embedded Mini-Map Header */}
      <div style={{ height: '150px', width: '100%', position: 'relative', background: '#F1F5F9' }}>
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={14}
          zoomControl={false}
          attributionControl={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          style={{ height: '100%', width: '100%', pointerEvents: 'none' }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MiniMapAutoFitter
            type={geofence.type}
            center={center}
            radius={geofence.radius}
            points={normalizedPoints}
          />

          {isCircle && (
            <Circle
              center={[center.lat, center.lng]}
              radius={parseFloat(geofence.radius) || 200}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.35,
                weight: 2.5,
              }}
            />
          )}

          {!isCircle && normalizedPoints.length >= 3 && (
            <Polygon
              positions={normalizedPoints.map((p) => [p.lat, p.lng])}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.35,
                weight: 2.5,
              }}
            />
          )}
        </MapContainer>

        {/* Top Badges overlay */}
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            right: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 400,
            pointerEvents: 'auto',
          }}
        >
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              background: '#FFFFFF',
              color: color,
              border: `1.5px solid ${color}`,
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
            }}
          >
            {isCircle ? 'Circular' : 'Polygon'}
          </span>

          {/* Active Switch Toggle */}
          <button
            type="button"
            onClick={() => onToggleActive(geofence.id, !geofence.is_active)}
            disabled={isToggling}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '99px',
              border: 'none',
              background: geofence.is_active ? '#10B981' : '#64748B',
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: 700,
              cursor: isToggling ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              transition: 'background 0.2s',
            }}
            title={geofence.is_active ? 'Click to disable geofence' : 'Click to enable geofence'}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#FFFFFF',
              }}
            />
            <span>{geofence.is_active ? 'Active' : 'Disabled'}</span>
          </button>
        </div>
      </div>

      {/* Card Info Content */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
              {geofence.name}
            </h4>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={12} color="#94A3B8" />
              <span>{center.lat.toFixed(5)}, {center.lng.toFixed(5)}</span>
            </div>
          </div>

          <div
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: color,
              border: '2px solid #FFFFFF',
              boxShadow: `0 0 0 1px ${color}`,
            }}
            title={`Color tag: ${color}`}
          />
        </div>

        {/* Metrics Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            background: '#F8FAFC',
            padding: '8px 12px',
            borderRadius: '10px',
            border: '1px solid #F1F5F9',
          }}
        >
          <div>
            <span style={{ display: 'block', fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>
              {isCircle ? 'Radius' : 'Vertices'}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
              {isCircle ? radiusText : `${normalizedPoints.length} points`}
            </span>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>
              Covered Area
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
              {areaText}
            </span>
          </div>
        </div>

        {/* Alert Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {geofence.alert_on_enter !== false && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                background: '#EFF6FF',
                color: '#2563EB',
                border: '1px solid #DBEAFE',
              }}
            >
              <Bell size={11} />
              <span>Enter Alert</span>
            </span>
          )}

          {geofence.alert_on_exit !== false && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                background: '#FEF3C7',
                color: '#D97706',
                border: '1px solid #FDE68A',
              }}
            >
              <Bell size={11} />
              <span>Exit Alert</span>
            </span>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            marginTop: 'auto',
            paddingTop: '10px',
            borderTop: '1px solid #F1F5F9',
          }}
        >
          {onSwitchPlace && (
            <button
              type="button"
              onClick={() => onSwitchPlace(geofence)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #CCFBF1',
                background: '#F0FDFA',
                color: '#0D9488',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Switch to another saved warehouse (e.g. Nellore or Hyderabad)"
            >
              <ArrowRightLeft size={12} />
              <span>Switch Place</span>
            </button>
          )}

          <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
            <button
              type="button"
              onClick={() => onEdit(geofence)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                color: '#334155',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Edit3 size={12} />
              <span>Edit</span>
            </button>

            <button
              type="button"
              onClick={() => onDelete(geofence.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #FECACA',
                background: '#FEF2F2',
                color: '#EF4444',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Unlink this geofence from this vehicle"
            >
              <Trash2 size={12} />
              <span>Unlink</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VehicleGeofenceCard;
