import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bell, Settings, History, Radio, CheckCheck, Check,
  Loader2, AlertTriangle, Zap, Shield, Car,
  ToggleLeft, ToggleRight, ChevronLeft, ChevronRight,
  RefreshCw, Info, Filter
} from 'lucide-react';
import alertsApi from '../../api/alertsApi';
import { useSocket } from '../../hooks/useSocket';

// ─── Alert type metadata ───────────────────────────────────────────────────────
const ALERT_GROUPS = [
  {
    label: 'Critical',
    color: '#EF4444',
    bg: '#FEF2F2',
    border: '#FECACA',
    dot: '#DC2626',
    types: [
      { key: 'sos', label: 'SOS' },
      { key: 'panic', label: 'Panic Button' },
      { key: 'crash', label: 'Crash Detected' },
      { key: 'accident', label: 'Accident' },
      { key: 'theft', label: 'Theft' },
      { key: 'theft_alarm', label: 'Theft Alarm' },
      { key: 'power_cut', label: 'Power Cut' },
      { key: 'tow', label: 'Tow Detected' },
    ],
  },
  {
    label: 'Warning',
    color: '#F59E0B',
    bg: '#FFFBEB',
    border: '#FDE68A',
    dot: '#D97706',
    types: [
      { key: 'overspeed', label: 'Overspeed' },
      { key: 'harsh_braking', label: 'Harsh Braking' },
      { key: 'harsh_acceleration', label: 'Harsh Acceleration' },
      { key: 'geofence_enter', label: 'Geofence Entry' },
      { key: 'geofence_exit', label: 'Geofence Exit' },
      { key: 'low_battery', label: 'Low Battery' },
    ],
  },
  {
    label: 'Info',
    color: '#3B82F6',
    bg: '#EFF6FF',
    border: '#BFDBFE',
    dot: '#2563EB',
    types: [
      { key: 'ignition_on', label: 'Ignition ON' },
      { key: 'ignition_off', label: 'Ignition OFF' },
      { key: 'idle', label: 'Idling' },
      { key: 'stoppage', label: 'Stoppage' },
      { key: 'trip_started', label: 'Trip Started' },
      { key: 'stopped', label: 'Stopped' },
    ],
  },
];

const ALL_TYPES_MAP = {};
ALERT_GROUPS.forEach(g => g.types.forEach(t => { ALL_TYPES_MAP[t.key] = { ...t, group: g }; }));

function getAlertMeta(alertType) {
  const key = (alertType || '').toLowerCase();
  return ALL_TYPES_MAP[key] || { label: alertType, group: { color: '#64748B', bg: '#F1F5F9', border: '#E2E8F0', dot: '#64748B', label: 'Other' } };
}

function formatTime(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ts; }
}

// ─── Real-time Toast ───────────────────────────────────────────────────────────
function LiveToast({ toast, onDismiss }) {
  const meta = getAlertMeta(toast.alertType);
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div style={{
      background: '#FFFFFF',
      border: `1px solid ${meta.group.border}`,
      borderLeft: `4px solid ${meta.group.color}`,
      borderRadius: '12px',
      padding: '14px 18px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      display: 'flex', alignItems: 'flex-start', gap: '12px',
      marginBottom: '10px',
      animation: 'slideIn 0.3s ease',
      maxWidth: '360px',
    }}>
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: meta.group.dot, marginTop: '5px', flexShrink: 0
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: meta.group.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {meta.label}
        </div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginTop: '2px' }}>{toast.vehicleName}</div>
        <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{toast.alertText}</div>
      </div>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0 }}>×</button>
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────
function HistoryTab() {
  const [alerts, setAlerts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await alertsApi.getAlerts({ page, limit: 50, alertType: filterType || undefined });
      setAlerts(res.alerts || []);
      setPagination(res.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, filterType]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const handleMarkRead = async (alertId) => {
    try {
      await alertsApi.markAlertRead(alertId);
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, isRead: true } : a));
    } catch (e) { console.error(e); }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await alertsApi.markAllRead();
      setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
    } catch (e) { console.error(e); }
    setMarkingAll(false);
  };

  const unreadCount = alerts.filter(a => !a.isRead).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 24px 0', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <Filter size={14} color="#6B7280" />
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setPage(1); }}
            style={{
              border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px 12px',
              fontSize: '13px', color: '#374151', background: '#F8FAFC', outline: 'none'
            }}
          >
            <option value="">All Types</option>
            {ALERT_GROUPS.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.types.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0',
              borderRadius: '8px', color: '#16A34A', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            {markingAll ? <Loader2 size={14} className="spin" /> : <CheckCheck size={14} />}
            Mark All Read ({unreadCount})
          </button>
        )}
        <button
          onClick={loadAlerts}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', background: '#EFF6FF', border: '1px solid #BFDBFE',
            borderRadius: '8px', color: '#2563EB', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
          }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ padding: '12px 24px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', color: '#6B7280' }}>
          {pagination.total} total alert{pagination.total !== 1 ? 's' : ''}
          {unreadCount > 0 && <span style={{ marginLeft: '8px', background: '#EF4444', color: '#fff', borderRadius: '10px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>{unreadCount} unread</span>}
        </span>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <Loader2 size={28} color="#f97316" className="spin" />
          </div>
        ) : alerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
            <Bell size={48} color="#E2E8F0" style={{ marginBottom: '12px' }} />
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#374151' }}>No alerts found</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>Alerts will appear here as your vehicles trigger them.</div>
          </div>
        ) : (
          <div>
            {alerts.map(alert => {
              const meta = getAlertMeta(alert.alertType);
              return (
                <div
                  key={alert.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '14px 16px', borderRadius: '12px',
                    background: alert.isRead ? 'transparent' : meta.group.bg,
                    border: `1px solid ${alert.isRead ? '#F1F5F9' : meta.group.border}`,
                    marginBottom: '8px',
                    transition: 'all 0.2s',
                  }}
                >
                  {/* Status dot */}
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                    background: alert.isRead ? '#CBD5E1' : meta.group.dot
                  }} />

                  {/* Alert type badge */}
                  <div style={{
                    padding: '4px 10px', borderRadius: '6px',
                    background: alert.isRead ? '#F1F5F9' : meta.group.bg,
                    border: `1px solid ${alert.isRead ? '#E2E8F0' : meta.group.border}`,
                    fontSize: '11px', fontWeight: 700,
                    color: alert.isRead ? '#64748B' : meta.group.color,
                    whiteSpace: 'nowrap', flexShrink: 0, minWidth: '90px', textAlign: 'center',
                    textTransform: 'uppercase', letterSpacing: '0.04em'
                  }}>
                    {meta.label}
                  </div>

                  {/* Vehicle info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Car size={12} color="#6B7280" />
                      {alert.vehicleName}
                      <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 500 }}>{alert.plate}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{alert.alertText}</div>
                  </div>

                  {/* Time */}
                  <div style={{ fontSize: '11px', color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {formatTime(alert.serverTime || alert.deviceTime)}
                  </div>

                  {/* Mark read button */}
                  {!alert.isRead && (
                    <button
                      onClick={() => handleMarkRead(alert.id)}
                      title="Mark as read"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '28px', height: '28px', borderRadius: '8px',
                        background: '#F0FDF4', border: '1px solid #BBF7D0',
                        color: '#16A34A', cursor: 'pointer', flexShrink: 0,
                        transition: 'all 0.2s'
                      }}
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
          padding: '16px', borderTop: '1px solid #F1F5F9', flexShrink: 0
        }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0',
              background: page === 1 ? '#F8FAFC' : '#fff',
              color: page === 1 ? '#CBD5E1' : '#374151', cursor: page === 1 ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: 600
            }}
          >
            <ChevronLeft size={14} />
            Prev
          </button>
          <span style={{ fontSize: '13px', color: '#6B7280' }}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0',
              background: page === pagination.totalPages ? '#F8FAFC' : '#fff',
              color: page === pagination.totalPages ? '#CBD5E1' : '#374151',
              cursor: page === pagination.totalPages ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: 600
            }}
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Preferences Tab ──────────────────────────────────────────────────────────
function PreferencesTab() {
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    alertsApi.getPreferences()
      .then(res => setPrefs(res.preferences))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key) => {
    setPrefs(p => ({ ...p, [key]: !p[key] }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await alertsApi.updatePreferences(prefs);
      setPrefs(res.preferences);
      setSaved(true);
      window.dispatchEvent(new CustomEvent('preferences-updated', { detail: res.preferences }));
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <Loader2 size={28} color="#f97316" className="spin" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Notification Preferences</div>
          <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '2px' }}>
            Choose which alerts you want to receive via push notifications.
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '9px 20px', borderRadius: '10px',
            background: saved ? '#16A34A' : '#f97316',
            color: '#fff', border: 'none', fontWeight: 700, fontSize: '14px',
            cursor: saving ? 'wait' : 'pointer',
            transition: 'background 0.3s',
            boxShadow: '0 4px 12px rgba(249,115,22,0.25)'
          }}
        >
          {saving ? <Loader2 size={16} className="spin" /> : saved ? <Check size={16} /> : null}
          {saved ? 'Saved!' : 'Save Preferences'}
        </button>
      </div>

      {ALERT_GROUPS.map(group => (
        <div key={group.label} style={{ marginBottom: '28px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '12px', paddingBottom: '8px',
            borderBottom: `2px solid ${group.border}`
          }}>
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%', background: group.dot
            }} />
            <span style={{ fontSize: '13px', fontWeight: 800, color: group.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {group.label} Alerts
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
            {group.types.map(type => {
              const enabled = prefs?.[type.key] ?? true;
              return (
                <div
                  key={type.key}
                  onClick={() => toggle(type.key)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
                    border: `1px solid ${enabled ? group.border : '#E2E8F0'}`,
                    background: enabled ? group.bg : '#F8FAFC',
                    transition: 'all 0.2s',
                    userSelect: 'none',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 600, color: enabled ? group.color : '#9CA3AF' }}>
                    {type.label}
                  </span>
                  <div style={{ color: enabled ? group.color : '#CBD5E1', flexShrink: 0 }}>
                    {enabled
                      ? <ToggleRight size={24} />
                      : <ToggleLeft size={24} />
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Live Feed Tab ─────────────────────────────────────────────────────────────
function LiveFeedTab() {
  const { socket } = useSocket();
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (!socket) return;
    setConnected(socket.connected);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onAlert = (data) => {
      setLiveAlerts(prev => [{ ...data, _id: Date.now() + Math.random() }, ...prev].slice(0, 100));
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('alert:new', onAlert);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('alert:new', onAlert);
    };
  }, [socket]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Status bar */}
      <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
          background: connected ? '#22C55E' : '#EF4444',
          boxShadow: connected ? '0 0 0 3px rgba(34,197,94,0.2)' : 'none',
          animation: connected ? 'pulse 2s infinite' : 'none'
        }} />
        <span style={{ fontSize: '13px', fontWeight: 600, color: connected ? '#16A34A' : '#EF4444' }}>
          {connected ? 'Live — Connected' : 'Disconnected'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#9CA3AF' }}>
          {liveAlerts.length} event{liveAlerts.length !== 1 ? 's' : ''} received this session
        </span>
        {liveAlerts.length > 0 && (
          <button
            onClick={() => setLiveAlerts([])}
            style={{ fontSize: '12px', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Feed */}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {liveAlerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
            <Radio size={48} color="#E2E8F0" style={{ marginBottom: '12px' }} />
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#374151' }}>Listening for alerts…</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>
              {connected ? 'Real-time alerts from your vehicles will appear here instantly.' : 'Waiting for connection to establish.'}
            </div>
          </div>
        ) : (
          liveAlerts.map((alert) => {
            const meta = getAlertMeta(alert.alertType);
            return (
              <div
                key={alert._id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '14px',
                  padding: '14px 16px', borderRadius: '12px', marginBottom: '8px',
                  background: meta.group.bg, border: `1px solid ${meta.group.border}`,
                  borderLeft: `4px solid ${meta.group.color}`,
                  animation: 'slideIn 0.3s ease',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: meta.group.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {meta.label}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{alert.vehicleName}</span>
                    <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{alert.plate}</span>
                  </div>
                  {alert.alertText && (
                    <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>{alert.alertText}</div>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {formatTime(alert.serverTime || alert.deviceTime)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'history', label: 'Alert History', icon: History },
  { id: 'settings', label: 'Notification Settings', icon: Settings },
  { id: 'live', label: 'Live Feed', icon: Radio },
];

const AlertsPage = () => {
  const [activeTab, setActiveTab] = useState('history');
  const [toasts, setToasts] = useState([]);
  const [globalPrefs, setGlobalPrefs] = useState(null);
  const { socket } = useSocket();

  // Load preferences for live toast filtering
  useEffect(() => {
    alertsApi.getPreferences().then(res => {
      if (res.preferences) setGlobalPrefs(res.preferences);
    }).catch(console.error);
    
    const handlePrefsUpdated = (e) => setGlobalPrefs(e.detail);
    window.addEventListener('preferences-updated', handlePrefsUpdated);
    return () => window.removeEventListener('preferences-updated', handlePrefsUpdated);
  }, []);

  // Real-time toasts across all tabs
  useEffect(() => {
    if (!socket) return;
    const onAlert = (data) => {
      if (!globalPrefs || globalPrefs[data.alertType] === false) return;
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { ...data, _id: id }]);
    };
    socket.on('alert:new', onAlert);
    return () => socket.off('alert:new', onAlert);
  }, [socket, globalPrefs]);

  const dismissToast = (id) => setToasts(prev => prev.filter(t => t._id !== id));

  return (
    <div style={{ padding: '32px', background: '#EEF5F8', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexShrink: 0, flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bell size={26} color="#f97316" />
            Alerts & Notifications
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>
            Monitor your vehicle alerts, manage preferences, and track real-time events.
          </p>
        </div>
      </div>

      {/* Card with tabs */}
      <div style={{
        background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
        boxShadow: '0 4px 6px rgba(0,0,0,0.02)', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* Tab bar */}
        <div style={{
          display: 'flex', borderBottom: '1px solid #F1F5F9',
          padding: '0 24px', background: '#FAFAFA', flexShrink: 0, gap: '4px',
          overflowX: 'auto',
        }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: active ? 700 : 500,
                  color: active ? '#f97316' : '#6B7280',
                  borderBottom: `2px solid ${active ? '#f97316' : 'transparent'}`,
                  transition: 'all 0.2s', whiteSpace: 'nowrap',
                  marginBottom: '-1px',
                }}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeTab === 'history' && <HistoryTab />}
          {activeTab === 'settings' && <PreferencesTab />}
          {activeTab === 'live' && <LiveFeedTab />}
        </div>
      </div>

      {/* Toast container */}
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
        display: 'flex', flexDirection: 'column-reverse', gap: '10px'
      }}>
        {toasts.map(t => (
          <LiveToast key={t._id} toast={t} onDismiss={() => dismissToast(t._id)} />
        ))}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
          50%      { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
        }
      `}} />
    </div>
  );
};

export default AlertsPage;
