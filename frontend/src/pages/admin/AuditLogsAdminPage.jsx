import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ClipboardList, Search, Filter, RefreshCw, Eye, X,
  Building2, Users, Cpu, Truck, Shield, Key, LogIn, Settings,
  ChevronLeft, ChevronRight, Calendar, Download, Archive
} from 'lucide-react';
import { getAuditLogs, getAuditStats } from '../../api/adminApi';

// ─── Colour palette per audit type ──────────────────────────────────────────
const TYPE_CONFIG = {
  organization: { label: 'Organization', color: '#6366F1', bg: '#EEF2FF', icon: Building2 },
  user:         { label: 'User',         color: '#0EA5E9', bg: '#E0F2FE', icon: Users    },
  group:        { label: 'Group',        color: '#10B981', bg: '#D1FAE5', icon: Users    },
  vehicle:      { label: 'Vehicle',      color: '#F59E0B', bg: '#FEF3C7', icon: Truck    },
  device:       { label: 'Device',       color: '#8B5CF6', bg: '#EDE9FE', icon: Cpu      },
  license:      { label: 'License',      color: '#EC4899', bg: '#FCE7F3', icon: Key      },
  login:        { label: 'Login',        color: '#64748B', bg: '#F1F5F9', icon: LogIn    },
  system:       { label: 'System',       color: '#374151', bg: '#F3F4F6', icon: Settings },
};

const ACTION_COLORS = {
  CREATED:       { color: '#059669', bg: '#D1FAE5' },
  REGISTERED:    { color: '#059669', bg: '#D1FAE5' },
  UPDATED:       { color: '#D97706', bg: '#FEF3C7' },
  DELETED:       { color: '#DC2626', bg: '#FEE2E2' },
  LOGIN_SUCCESS: { color: '#059669', bg: '#D1FAE5' },
  LOGIN_FAILED:  { color: '#DC2626', bg: '#FEE2E2' },
  LOGOUT:        { color: '#64748B', bg: '#F1F5F9' },
  ASSIGNED:      { color: '#6366F1', bg: '#EEF2FF' },
  REMOVED:       { color: '#F59E0B', bg: '#FEF3C7' },
};

const TypeBadge = ({ type }) => {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.system;
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
      background: cfg.bg, color: cfg.color,
    }}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
};

const ActionBadge = ({ action }) => {
  const cfg = ACTION_COLORS[action] || { color: '#374151', bg: '#F3F4F6' };
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '99px',
      fontSize: '11px', fontWeight: 700, background: cfg.bg, color: cfg.color,
    }}>
      {action?.replace(/_/g, ' ')}
    </span>
  );
};

const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const StatCard = ({ label, value, icon: Icon, color, bg }) => (
  <div style={{
    background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0',
    padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    flex: 1, minWidth: '180px',
  }}>
    <div style={{
      width: '48px', height: '48px', borderRadius: '12px',
      background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Icon size={22} color={color} />
    </div>
    <div>
      <div style={{ fontSize: '28px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{value ?? '—'}</div>
      <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px', fontWeight: 500 }}>{label}</div>
    </div>
  </div>
);

// Detail drawer — shows full audit record info
const DetailDrawer = ({ log, onClose }) => {
  if (!log) return null;
  const formatDataValue = (val) => {
    if (val === null || val === undefined || val === '') return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>None</span>;
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
  };

  const renderDataPairs = (dataObj) => {
    try {
      const obj = typeof dataObj === 'string' ? JSON.parse(dataObj) : dataObj;
      if (!obj || Object.keys(obj).length === 0) return null;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Object.entries(obj).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: '8px', fontSize: '13px' }}>
              <span style={{ fontWeight: 600, color: '#475569', minWidth: '100px', textTransform: 'capitalize' }}>
                {k.replace(/_/g, ' ')}:
              </span>
              <span style={{ color: '#111827', wordBreak: 'break-word' }}>{formatDataValue(v)}</span>
            </div>
          ))}
        </div>
      );
    } catch {
      return <div style={{ fontSize: '13px', color: '#111827' }}>{String(dataObj)}</div>;
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '500px', maxWidth: '95vw', height: '100vh',
          background: '#FFFFFF', boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
          animation: 'slideInRight 0.25s ease',
        }}
      >
        {/* Drawer Header */}
        <div style={{
          padding: '24px', borderBottom: '1px solid #E2E8F0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <ClipboardList size={20} color="#f97316" />
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#111827', margin: 0 }}>Audit Detail</h2>
            </div>
            <div style={{ fontSize: '12px', color: '#6B7280' }}>Full event record</div>
          </div>
          <button onClick={onClose} style={{ background: '#F8FAFC', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#475569' }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Type + Action row */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <TypeBadge type={log.audit_type} />
            <ActionBadge action={log.action} />
          </div>

          {/* Info grid */}
          {[
            ['Entity', log.entity_name || log.entity_id || '—'],
            ['Entity Type', log.entity_type],
            ['Date & Time', formatDate(log.created_at)],
            ['Performed By', `${log.performed_by_name || '—'} (${log.performed_by_role || '—'})`],
            ['Email', log.performed_by_email || '—'],
            ['Organization', log.org_name || log.org_id || '—'],
            ['IP Address', log.ip_address || '—'],
          ].map(([k, v]) => (
            <div key={k} style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{k}</div>
              <div style={{ fontSize: '14px', color: '#111827', fontWeight: 500 }}>{v}</div>
            </div>
          ))}

          {/* Old Data */}
          {log.old_data && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Before (Old Data)</div>
              <div style={{
                background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '10px',
                padding: '14px'
              }}>
                {renderDataPairs(log.old_data)}
              </div>
            </div>
          )}

          {/* New Data */}
          {log.new_data && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>After (New Data)</div>
              <div style={{
                background: '#F0FFF4', border: '1px solid #BBF7D0', borderRadius: '10px',
                padding: '14px'
              }}>
                {renderDataPairs(log.new_data)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const AuditLogsAdminPage = () => {
  const [searchParams] = useSearchParams();
  const isArchived = searchParams.get('archived') === 'true';

  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  // Filters
  const [auditType, setAuditType] = useState('all');
  const [action, setAction] = useState('all');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 50 });

  // Local date helpers
  const { todayStr, yesterdayStr } = useMemo(() => {
    const getLocalYMD = (d) => {
      const offset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - offset).toISOString().split('T')[0];
    };
    const now = new Date();
    const today = getLocalYMD(now);
    
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const yesterday = getLocalYMD(yest);
    
    return { todayStr: today, yesterdayStr: yesterday };
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (auditType !== 'all') params.auditType = auditType;
      if (action !== 'all') params.action = action;
      if (search) params.search = search;
      
      if (isArchived) {
        if (startDate) {
          const sd = new Date(startDate);
          sd.setHours(0, 0, 0, 0);
          params.startDate = sd.toISOString();
        }
        const ed = new Date(endDate || yesterdayStr);
        ed.setHours(23, 59, 59, 999);
        params.endDate = ed.toISOString();
      } else {
        const sd = new Date();
        sd.setHours(0, 0, 0, 0);
        params.startDate = sd.toISOString();

        const ed = new Date();
        ed.setHours(23, 59, 59, 999);
        params.endDate = ed.toISOString();
      }

      const res = await getAuditLogs(params);
      if (res.success) {
        setLogs(res.data);
        setPagination(res.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, auditType, action, search, startDate, endDate, isArchived, todayStr, yesterdayStr]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await getAuditStats();
      if (res.success) setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch audit stats:', err);
    }
  }, []);

  useEffect(() => { fetchLogs(); fetchStats(); }, [fetchLogs, fetchStats]);

  // Reset to page 1 on filter change
  useEffect(() => { setPage(1); }, [auditType, action, search, startDate, endDate]);

  // Clear filters when switching between Audit and Archived Audit
  useEffect(() => {
    setPage(1);
    setAuditType('all');
    setAction('all');
    setSearch('');
    setStartDate('');
    setEndDate('');
  }, [isArchived]);

  const exportCSV = () => {
    if (!logs.length) return;
    const headers = ['Date', 'Type', 'Action', 'Entity', 'Performed By', 'Email', 'Organization', 'IP'];
    const rows = logs.map(l => [
      formatDate(l.created_at),
      l.audit_type,
      l.action,
      l.entity_name || l.entity_id || '',
      l.performed_by_name || '',
      l.performed_by_email || '',
      l.org_name || '',
      l.ip_address || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `audit-logs-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const inputStyle = {
    padding: '9px 14px', borderRadius: '8px', border: '1px solid #E2E8F0',
    fontSize: '13px', color: '#111827', outline: 'none', background: '#FFFFFF',
  };

  return (
    <div style={{
      padding: '32px',
      background: 'linear-gradient(to bottom, #f0f9ff 0%, #f0f9ff 180px, #f0f9ff 180px, #f0f9ff 100%)',
      minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
    }}>
      {/* Slide-in animation */}
      <style>{`@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isArchived ? <Archive size={24} color="#f97316" /> : <ClipboardList size={24} color="#f97316" />} 
            {isArchived ? "Archived Audit Logs" : "Today's Audit Logs"}
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>
            {isArchived 
              ? "Historical trail of configuration and business changes." 
              : "Today's trail of configuration and business changes."}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={fetchLogs} style={{ ...inputStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={exportCSV} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#f97316', color: '#FFF', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(249,115,22,0.25)' }}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      {stats && (
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <StatCard label="Total Events" value={Number(stats.total_logs).toLocaleString()} icon={ClipboardList} color="#f97316" bg="#f0f9ff" />
          <StatCard label="Today's Events" value={Number(stats.today_events).toLocaleString()} icon={Calendar} color="#6366F1" bg="#EEF2FF" />
          <StatCard label="Failed Logins" value={Number(stats.failed_logins).toLocaleString()} icon={LogIn} color="#DC2626" bg="#FEE2E2" />
          <StatCard label="Org Changes" value={Number(stats.org_changes).toLocaleString()} icon={Building2} color="#10B981" bg="#D1FAE5" />
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{
        background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0',
        padding: '16px 20px', marginBottom: '16px',
        display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
      }}>
        <Filter size={16} color="#94A3B8" />

        {/* Audit Type */}
        <select value={auditType} onChange={e => setAuditType(e.target.value)} style={inputStyle}>
          <option value="all">All Types</option>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        {/* Action */}
        <select value={action} onChange={e => setAction(e.target.value)} style={inputStyle}>
          <option value="all">All Actions</option>
          {['CREATED','UPDATED','DELETED','REGISTERED','ASSIGNED','REMOVED','LOGIN_SUCCESS','LOGIN_FAILED','LOGOUT'].map(a => (
            <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
          ))}
        </select>

        {/* Date range - only show for archived */}
        {isArchived && (
          <>
            <input type="date" max={yesterdayStr} value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
            <span style={{ fontSize: '13px', color: '#94A3B8' }}>to</span>
            <input type="date" max={yesterdayStr} value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
          </>
        )}

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px', background: '#EEF5F8', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '9px 14px' }}>
          <Search size={14} color="#94A3B8" />
          <input
            placeholder="Search entity, user, action..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', color: '#111827', width: '100%' }}
          />
        </div>

        {/* Clear */}
        {(auditType !== 'all' || action !== 'all' || search || startDate || endDate) && (
          <button
            onClick={() => { setAuditType('all'); setAction('all'); setSearch(''); setStartDate(''); setEndDate(''); }}
            style={{ padding: '9px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#EEF5F8', color: '#64748B', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div style={{
        background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
        boxShadow: '0 4px 6px rgba(0,0,0,0.02)', flex: 1, overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px', color: '#6B7280' }}>
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '14px', fontWeight: 500 }}>Loading audit logs...</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#EEF5F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={28} color="#D1D5DB" />
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>No audit logs found</div>
            <div style={{ fontSize: '13px', color: '#6B7280' }}>Try adjusting your filters or perform some actions</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['Date & Time', 'Type', 'Action', 'Entity', 'Performed By', 'Old Data', 'New Data', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: '13px', color: '#111827', fontWeight: 600 }}>
                        {new Date(log.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                        {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}><TypeBadge type={log.audit_type} /></td>
                    <td style={{ padding: '14px 16px' }}><ActionBadge action={log.action} /></td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{log.entity_name || '—'}</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8' }}>{log.entity_type}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{log.performed_by_name || '—'}</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8' }}>{log.performed_by_email || log.performed_by_role || ''}</div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: '#6B7280', maxWidth: '150px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                      {(() => {
                        if (!log.old_data) return <span style={{ color: '#CBD5E1' }}>—</span>;
                        try {
                          const obj = typeof log.old_data === 'string' ? JSON.parse(log.old_data) : log.old_data;
                          return Object.entries(obj).map(([k,v]) => <div key={k}><strong style={{ color: '#475569' }}>{k}</strong>: {String(v)}</div>);
                        } catch { return String(log.old_data); }
                      })()}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: '#6B7280', maxWidth: '150px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                      {(() => {
                        if (!log.new_data) return <span style={{ color: '#CBD5E1' }}>—</span>;
                        try {
                          const obj = typeof log.new_data === 'string' ? JSON.parse(log.new_data) : log.new_data;
                          return Object.entries(obj).map(([k,v]) => <div key={k}><strong style={{ color: '#475569' }}>{k}</strong>: {String(v)}</div>);
                        } catch { return String(log.new_data); }
                      })()}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <button
                        onClick={() => setSelectedLog(log)}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#EEF5F8', color: '#475569', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#f97316'; e.currentTarget.style.borderColor = '#f97316'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = '#E2E8F0'; }}
                      >
                        <Eye size={12} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && pagination.totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', borderTop: '1px solid #F1F5F9',
          }}>
            <div style={{ fontSize: '13px', color: '#6B7280' }}>
              Showing <strong>{((page - 1) * pagination.limit) + 1}–{Math.min(page * pagination.limit, pagination.total)}</strong> of <strong>{pagination.total}</strong> events
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: '8px', borderRadius: '8px', border: '1px solid #E2E8F0', background: page === 1 ? '#F8FAFC' : '#FFFFFF', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? '#CBD5E1' : '#475569', opacity: page === 1 ? 0.5 : 1 }}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>Page {page} of {pagination.totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                style={{ padding: '8px', borderRadius: '8px', border: '1px solid #E2E8F0', background: page === pagination.totalPages ? '#F8FAFC' : '#FFFFFF', cursor: page === pagination.totalPages ? 'not-allowed' : 'pointer', color: page === pagination.totalPages ? '#CBD5E1' : '#475569', opacity: page === pagination.totalPages ? 0.5 : 1 }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Drawer ── */}
      {selectedLog && <DetailDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  );
};

export default AuditLogsAdminPage;
