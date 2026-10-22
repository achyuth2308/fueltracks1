import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Home, ChevronRight, Loader2, AlertTriangle, CheckCircle2,
  Search, Plus, ArrowLeft, Save, MapPin, X, Clock, Bell, ShieldCheck
} from 'lucide-react';
import * as adminApi from '../../api/adminApi';

// FuelTracks Themed Minimal Switch
const FuelToggle = ({ checked, onChange, title }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    title={title}
    onClick={(e) => {
      e.stopPropagation();
      onChange(!checked);
    }}
    style={{
      width: '42px',
      height: '24px',
      borderRadius: '12px',
      background: checked ? '#f97316' : '#cbd5e1',
      border: 'none',
      cursor: 'pointer',
      padding: '2px',
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      transition: 'background 0.2s ease, box-shadow 0.2s ease',
      outline: 'none',
      boxShadow: checked ? '0 2px 8px rgba(249, 115, 22, 0.35)' : 'none'
    }}
  >
    <span
      style={{
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.22)',
        transform: checked ? 'translateX(18px)' : 'translateX(0)',
        transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'block'
      }}
    />
  </button>
);

export default function SiteNotificationPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [org, setOrg] = useState(null);
  const [sites, setSites] = useState([]);

  // Table Controls
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Site Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteTime, setNewSiteTime] = useState('00:00');
  const [newSiteEnabled, setNewSiteEnabled] = useState(true);
  const [creatingSite, setCreatingSite] = useState(false);

  // Fetch Sites and Organization
  const fetchSites = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch organization details
      const orgRes = await adminApi.getOrgById(id);
      let orgData = null;
      if (orgRes && orgRes.success && orgRes.data) {
        orgData = orgRes.data;
        setOrg(orgData);
      }

      const settings = (orgData && orgData.settings) || {};
      const siteSettings = settings.site_notifications || {};

      // 2. Fetch geofences from the database
      const geoRes = await adminApi.getGeofences();
      let siteList = [];

      if (geoRes && geoRes.success && Array.isArray(geoRes.data)) {
        // Filter by org if multi-tenant geofences exist, or include all relevant geofences
        const orgGeofences = geoRes.data.filter(g => !g.org_id || g.org_id === id);
        const targetList = orgGeofences.length > 0 ? orgGeofences : geoRes.data;

        siteList = targetList.map(g => {
          const saved = siteSettings[g.id] || {};
          return {
            id: g.id,
            name: g.name,
            time: saved.time !== undefined ? saved.time : (g.notification_time || '00:00'),
            enabled: saved.enabled !== undefined ? !!saved.enabled : (g.is_active !== false)
          };
        });
      }

      // If no geofences returned but settings has sites, use settings entries
      if (siteList.length === 0 && Object.keys(siteSettings).length > 0) {
        siteList = Object.entries(siteSettings).map(([sId, cfg], idx) => ({
          id: sId,
          name: cfg.name || `Site #${idx + 1}`,
          time: cfg.time || '00:00',
          enabled: cfg.enabled !== false
        }));
      }

      setSites(siteList);
    } catch (err) {
      console.error('fetchSites error:', err);
      setError('Failed to load site notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, [id]);

  // Handle Toggle Enable for a Site
  const handleToggleEnable = (siteId) => {
    setSites(prev =>
      prev.map(s => (s.id === siteId ? { ...s, enabled: !s.enabled } : s))
    );
  };

  // Handle Time Change for a Site
  const handleTimeChange = (siteId, newTime) => {
    setSites(prev =>
      prev.map(s => (s.id === siteId ? { ...s, time: newTime } : s))
    );
  };

  // Save / Update Site Notifications
  const handleUpdateSites = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Update geofences table (is_active and notification_time)
      for (const site of sites) {
        try {
          await adminApi.updateGeofence(site.id, {
            is_active: !!site.enabled,
            notification_time: site.time || '00:00'
          });
        } catch (e) {
          console.warn('Geofence update warning for site:', site.id, e.message);
        }
      }

      // 2. Persist in organization settings.site_notifications
      const currentSettings = org?.settings || {};
      const siteSettingsMap = { ...(currentSettings.site_notifications || {}) };
      sites.forEach(s => {
        siteSettingsMap[s.id] = {
          name: s.name,
          time: s.time || '00:00',
          enabled: !!s.enabled
        };
      });

      const resOrg = await adminApi.updateOrg(id, {
        settings: {
          ...currentSettings,
          site_notifications: siteSettingsMap
        }
      });

      if (resOrg && resOrg.success) {
        setSuccess('Site notifications updated successfully.');
        if (resOrg.data) setOrg(resOrg.data);
        setTimeout(() => setSuccess(null), 3500);
      } else {
        setError(resOrg?.error || 'Failed to update site notifications.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Server error while updating site notifications.');
    } finally {
      setSaving(false);
    }
  };

  // Create New Site
  const handleCreateSite = async (e) => {
    e.preventDefault();
    if (!newSiteName.trim()) {
      setError('Site name is required.');
      return;
    }

    setCreatingSite(true);
    setError(null);

    try {
      const geoRes = await adminApi.createGeofence({
        org_id: id,
        name: newSiteName.trim(),
        type: 'circle',
        coordinates: [{ lat: 17.385, lng: 78.4867 }],
        radius: 500,
        center_lat: 17.385,
        center_lng: 78.4867,
        is_active: newSiteEnabled,
        notification_time: newSiteTime || '00:00'
      });

      let created = null;
      if (geoRes && geoRes.success && geoRes.data) {
        const g = geoRes.data;
        created = {
          id: g.id,
          name: g.name,
          time: newSiteTime || '00:00',
          enabled: newSiteEnabled
        };
      } else {
        const newId = 'site_' + Date.now();
        created = {
          id: newId,
          name: newSiteName.trim(),
          time: newSiteTime || '00:00',
          enabled: newSiteEnabled
        };
      }

      // Persist in org settings
      const currentSettings = org?.settings || {};
      const siteSettingsMap = { ...(currentSettings.site_notifications || {}) };
      siteSettingsMap[created.id] = {
        name: created.name,
        time: created.time,
        enabled: created.enabled
      };

      await adminApi.updateOrg(id, {
        settings: {
          ...currentSettings,
          site_notifications: siteSettingsMap
        }
      });

      setSites(prev => [...prev, created]);
      setIsAddModalOpen(false);
      setNewSiteName('');
      setNewSiteTime('00:00');
      setNewSiteEnabled(true);
      setSuccess('New site added successfully.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create site.');
    } finally {
      setCreatingSite(false);
    }
  };

  // Filter Sites
  const filteredSites = useMemo(() => {
    let list = [...sites];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.time && s.time.toLowerCase().includes(q))
      );
    }
    return list;
  }, [sites, searchQuery]);

  // Pagination
  const totalEntries = filteredSites.length;
  const totalPages = Math.ceil(totalEntries / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalEntries);
  const paginatedSites = filteredSites.slice(startIndex, endIndex);

  const orgDisplayName = org?.name || org?.phone || 'Organization';
  const activeCount = sites.filter(s => s.enabled).length;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px' }}>
        <Loader2 size={32} color="#f97316" className="animate-spin" />
        <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>Loading site notifications...</span>
      </div>
    );
  }

  return (
    <div className="pastel-page-bg" style={{ padding: '32px', minHeight: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
        {/* Top Header & Breadcrumbs Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '28px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            {/* Breadcrumbs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
                title="Dashboard"
              >
                <Home size={15} />
              </button>
              <ChevronRight size={13} color="#94a3b8" />
              <button
                type="button"
                onClick={() => navigate('/admin/organizations')}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#64748b', fontWeight: 500 }}
              >
                Organizations
              </button>
              <ChevronRight size={13} color="#94a3b8" />
              <span style={{ color: '#64748b' }}>Site Notification</span>
              <ChevronRight size={13} color="#94a3b8" />
              <span style={{ color: '#f97316', fontWeight: 700 }}>{orgDisplayName}</span>
            </div>

            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>
              Site Notification
            </h1>
            <p style={{ fontSize: '14px', color: '#64748b', marginTop: '6px', marginBottom: 0, lineHeight: 1.5 }}>
              Configure geofence landmark site entry, exit, and dwell-time alerts.
            </p>
          </div>

          {/* Right Header Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => navigate('/admin/organizations')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.background = '#f8fafc'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#ffffff'; }}
            >
              <ArrowLeft size={15} />
              <span>Organizations</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '10px',
                border: 'none',
                background: '#f97316',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(249,115,22,0.25)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#ea580c'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f97316'; e.currentTarget.style.transform = 'none'; }}
            >
              <Plus size={16} />
              <span>Add Site</span>
            </button>
          </div>
        </div>

      {/* Status Feedback */}
      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '10px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#dc2626',
          fontSize: '13.5px',
          fontWeight: 600,
          marginBottom: '16px'
        }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '10px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#16a34a',
          fontSize: '13.5px',
          fontWeight: 600,
          marginBottom: '16px'
        }}>
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* Main Container Card */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '24px 28px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03), 0 2px 4px -2px rgba(0,0,0,0.03)'
      }}>
        {/* Organization Info Header Banner */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 16px',
          background: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#fff7ed',
              color: '#f97316',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #fed7aa'
            }}>
              <MapPin size={16} />
            </div>
            <div>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Target Organization</span>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                {orgDisplayName}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '12px',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: '20px',
              background: '#fff7ed',
              color: '#ea580c',
              border: '1px solid #fed7aa',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <Bell size={12} />
              {activeCount} Active / {sites.length} Total Sites
            </span>
          </div>
        </div>

        {/* Toolbar: Show Entries & Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569' }}>
            <span style={{ fontWeight: 500 }}>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                color: '#334155',
                outline: 'none',
                background: '#ffffff',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span style={{ fontWeight: 500 }}>entries</span>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={searchQuery}
              placeholder="Filter sites..."
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '7px 14px 7px 34px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                color: '#334155',
                outline: 'none',
                width: '230px',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
              }}
              onFocus={e => {
                e.target.style.borderColor = '#f97316';
                e.target.style.boxShadow = '0 0 0 3px rgba(249, 115, 22, 0.15)';
              }}
              onBlur={e => {
                e.target.style.borderColor = '#cbd5e1';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>
        </div>

        {/* Table Structure */}
        <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: '#1e1b4b', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{
                  padding: '14px 20px',
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  width: '10%',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  ID
                </th>

                <th style={{
                  padding: '14px 24px',
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  width: '45%',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Site Name
                </th>

                <th style={{
                  padding: '14px 20px',
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  width: '25%',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Time
                </th>

                <th style={{
                  padding: '14px 20px',
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  width: '20%',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Enable
                </th>
              </tr>
            </thead>

            <tbody>
              {paginatedSites.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      padding: '44px 20px',
                      textAlign: 'center',
                      fontSize: '14px',
                      color: '#64748b',
                      background: '#ffffff',
                      fontWeight: 500
                    }}
                  >
                    No sites available. Click "+ Add Site" above to configure your first landmark alert.
                  </td>
                </tr>
              ) : (
                paginatedSites.map((site, index) => {
                  const rowNumber = startIndex + index + 1;
                  const isEven = index % 2 === 1;

                  return (
                    <tr
                      key={site.id}
                      style={{
                        background: isEven ? '#F8FAFC' : '#ffffff',
                        borderBottom: '1px solid #F1F5F9',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FFF7ED'}
                      onMouseLeave={e => e.currentTarget.style.background = isEven ? '#F8FAFC' : '#ffffff'}
                    >
                      {/* ID */}
                      <td style={{ padding: '14px 20px', textAlign: 'center', fontSize: '13.5px', fontWeight: 600, color: '#475569' }}>
                        {rowNumber}
                      </td>

                      {/* Site Name with FuelTracks orange icon */}
                      <td style={{ padding: '14px 24px', fontSize: '13.5px', fontWeight: 700, color: '#111827' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '7px',
                            background: '#FFF7ED',
                            color: '#F97316',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid #FED7AA',
                            flexShrink: 0
                          }}>
                            <MapPin size={15} />
                          </div>
                          <span>{site.name}</span>
                        </div>
                      </td>

                      {/* Time Input with Embedded Clock Icon */}
                      <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: '105px' }}>
                          <Clock size={13} color="#94a3b8" style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }} />
                          <input
                            type="text"
                            value={site.time || '00:00'}
                            onChange={(e) => handleTimeChange(site.id, e.target.value)}
                            placeholder="00:00"
                            style={{
                              width: '100%',
                              height: '32px',
                              paddingLeft: '28px',
                              paddingRight: '8px',
                              borderRadius: '7px',
                              border: '1px solid #cbd5e1',
                              fontSize: '13px',
                              fontWeight: 600,
                              color: '#334155',
                              outline: 'none',
                              textAlign: 'center',
                              background: '#ffffff',
                              boxSizing: 'border-box',
                              transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                            }}
                            onFocus={e => {
                              e.target.style.borderColor = '#f97316';
                              e.target.style.boxShadow = '0 0 0 3px rgba(249, 115, 22, 0.15)';
                            }}
                            onBlur={e => {
                              e.target.style.borderColor = '#cbd5e1';
                              e.target.style.boxShadow = 'none';
                            }}
                          />
                        </div>
                      </td>

                      {/* Enable Switch */}
                      <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                          <FuelToggle
                            checked={!!site.enabled}
                            onChange={() => handleToggleEnable(site.id)}
                            title={`${site.name} notification active`}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: Count and Pagination */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '20px',
          fontSize: '13px',
          color: '#64748b',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            Showing {totalEntries === 0 ? 0 : startIndex + 1} to {endIndex} of {totalEntries} entries
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: currentPage <= 1 ? '#f8fafc' : '#ffffff',
                color: currentPage <= 1 ? '#94a3b8' : '#334155',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Previous
            </button>

            <span style={{
              padding: '6px 12px',
              borderRadius: '8px',
              background: '#f97316',
              color: '#ffffff',
              fontSize: '12.5px',
              fontWeight: 700,
              boxShadow: '0 2px 6px rgba(249, 115, 22, 0.25)'
            }}>
              {currentPage}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: currentPage >= totalPages ? '#f8fafc' : '#ffffff',
                color: currentPage >= totalPages ? '#94a3b8' : '#334155',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Next
            </button>
          </div>
        </div>

        {/* Update Site Button Action Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: '32px',
          paddingTop: '20px',
          borderTop: '1px solid #f1f5f9'
        }}>
          <button
            type="button"
            onClick={handleUpdateSites}
            disabled={saving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '11px 36px',
              borderRadius: '10px',
              background: '#f97316',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 700,
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)',
              transition: 'all 0.15s ease',
              opacity: saving ? 0.7 : 1
            }}
            onMouseEnter={e => {
              if (!saving) {
                e.currentTarget.style.background = '#ea580c';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(249, 115, 22, 0.4)';
              }
            }}
            onMouseLeave={e => {
              if (!saving) {
                e.currentTarget.style.background = '#f97316';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(249, 115, 22, 0.3)';
              }
            }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{saving ? 'Updating Sites...' : 'Update Site'}</span>
          </button>
        </div>
      </div>
      </div>

      {/* Add Site Modal */}
      {isAddModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '460px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            border: '1px solid #E2E8F0'
          }}>
            <div style={{
              padding: '16px 22px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#FFF7ED',
                  color: '#F97316',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #FED7AA'
                }}>
                  <MapPin size={16} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Add Geofence Site
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSite} style={{ padding: '22px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Site Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hyderabad Depot, Mining Pit 2"
                  value={newSiteName}
                  onChange={e => setNewSiteName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={e => e.target.style.borderColor = '#f97316'}
                  onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Notification Dwell Time (HH:MM or mins)
                </label>
                <div style={{ position: 'relative' }}>
                  <Clock size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="00:00"
                    value={newSiteTime}
                    onChange={e => setNewSiteTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 32px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s ease'
                    }}
                    onFocus={e => e.target.style.borderColor = '#f97316'}
                    onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                  />
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '10px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                marginBottom: '22px'
              }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Enable Notifications for this Site
                </span>
                <FuelToggle
                  checked={newSiteEnabled}
                  onChange={setNewSiteEnabled}
                  title="Enable Site Notification"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creatingSite}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#f97316',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: creatingSite ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(249,115,22,0.25)',
                    opacity: creatingSite ? 0.7 : 1
                  }}
                >
                  {creatingSite ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  <span>{creatingSite ? 'Adding...' : 'Add Site'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
