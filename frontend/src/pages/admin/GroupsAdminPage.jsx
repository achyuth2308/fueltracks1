import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users2, ArrowLeft, Plus, Edit, Trash2, Loader2, AlertTriangle, Search, ChevronRight, User, Truck, X } from 'lucide-react';
import * as adminApi from '../../api/adminApi';
import AddGroupModal from '../../components/modals/AddGroupModal';

const GroupsAdminPage = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [viewingGroup, setViewingGroup] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [groupsRes, orgsRes, usersRes] = await Promise.all([
        adminApi.getGroups({ t: Date.now() }),
        adminApi.getOrgs().catch(() => ({ success: false, data: [] })),
        adminApi.getUsers().catch(() => ({ success: false, data: [] }))
      ]);
      if (groupsRes.success) setGroups(groupsRes.data);
      if (orgsRes.success) setOrgs(orgsRes.data);
      if (usersRes?.success && Array.isArray(usersRes.data)) setUsers(usersRes.data);
    } catch (err) {
      setError('Failed to load group records. You may not have access.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getAssignedUsers = (group) => {
    if (group.users && Array.isArray(group.users) && group.users.length > 0) {
      return group.users;
    }
    if (users && users.length > 0) {
      return users.filter(u => {
        if (Array.isArray(u.groups)) {
          return u.groups.some(ug => String(ug.id) === String(group.id) || String(ug.name).toLowerCase() === String(group.name).toLowerCase());
        }
        if (typeof u.group_names === 'string') {
          const names = u.group_names.split(',').map(s => s.trim().toLowerCase());
          return names.includes(String(group.name).toLowerCase());
        }
        return false;
      });
    }
    return [];
  };

  const handleSaveGroup = async (groupData) => {
    if (editingGroup) {
      const payload = {
        ...groupData,
        orgId: groupData.orgId || editingGroup.org_id
      };
      await adminApi.updateGroup(editingGroup.id, payload);
      setViewingGroup(prev => prev && prev.id === editingGroup.id ? { ...prev, name: payload.name, org_id: payload.orgId } : prev);
    } else {
      const payload = {
        ...groupData,
        orgId: groupData.orgId || (orgs && orgs[0]?.id)
      };
      await adminApi.createGroup(payload);
    }
    fetchData();
  };

  const handleDeleteGroup = async (groupToDelete) => {
    if (window.confirm('Are you sure you want to delete this group?')) {
      await adminApi.deleteGroup(groupToDelete.id);
      if (viewingGroup && viewingGroup.id === groupToDelete.id) {
        setViewingGroup(null);
      }
      fetchData();
    }
  };

  const getMatchingVehicles = (group, query) => {
    if (!query || !query.trim() || !group?.vehicles || !Array.isArray(group.vehicles)) return [];
    const q = query.trim().toLowerCase();
    return group.vehicles.filter(v => {
      const plate = (v.plate || '').toLowerCase();
      const name = (v.name || '').toLowerCase();
      const imei = (v.imei || '').toLowerCase();
      const vid = (v.vehicleId || '').toLowerCase();
      return plate.includes(q) || name.includes(q) || imei.includes(q) || vid.includes(q);
    });
  };

  const filteredGroups = groups.filter(g => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();

    // 1. Match Group name, description, or organization
    if ((g.name || '').toLowerCase().includes(q)) return true;
    if ((g.description || '').toLowerCase().includes(q)) return true;
    if ((g.org_name || '').toLowerCase().includes(q)) return true;

    // 2. Match vehicle plate, name, imei, or vehicleId in this group
    if (g.vehicles && Array.isArray(g.vehicles)) {
      const hasVehicleMatch = g.vehicles.some(v =>
        (v.plate || '').toLowerCase().includes(q) ||
        (v.name || '').toLowerCase().includes(q) ||
        (v.imei || '').toLowerCase().includes(q) ||
        (v.vehicleId || '').toLowerCase().includes(q)
      );
      if (hasVehicleMatch) return true;
    }

    // 3. Match assigned users
    const assigned = getAssignedUsers(g);
    if (assigned && assigned.length > 0) {
      const hasUserMatch = assigned.some(u =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
      if (hasUserMatch) return true;
    }

    return false;
  });

  return (
    <div className="pastel-page-bg" style={{ padding: '16px 20px', height: '100%', display: 'flex', flexDirection: 'column', gap: '10px', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              cursor: 'pointer',
              color: '#334155',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#94A3B8'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
            title="Go Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Groups Management</h1>
            <p style={{ fontSize: '12px', color: '#475569', margin: '2px 0 0 0' }}>Organize fleets into operational zones and assign user access.</p>
          </div>
        </div>
        <button
          onClick={() => { setEditingGroup(null); setIsAddModalOpen(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'var(--brand-primary, #f97316)', color: '#FFFFFF',
            padding: '6px 12px', borderRadius: '8px',
            fontSize: '12px', fontWeight: 700, border: 'none',
            cursor: 'pointer', boxShadow: '0 2px 8px var(--brand-glow, rgba(249,115,22,0.25))',
            transition: 'all 0.15s ease'
          }}
        >
          <Plus size={16} />
          <span>New Group</span>
        </button>
      </div>

      <AddGroupModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveGroup}
        orgs={orgs}
        editingGroup={editingGroup}
      />

      {/* Search Bar */}
      <div style={{ background: '#FFFFFF', padding: '10px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
          <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} size={15} />
          <input
            type="text"
            placeholder="Search by group name or vehicle number / plate..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '7px 30px 7px 32px',
              borderRadius: '6px', border: '1px solid #CBD5E1',
              fontSize: '12.5px', outline: 'none', color: '#0F172A', boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer',
                padding: '2px', display: 'flex', alignItems: 'center'
              }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {searchQuery.trim() && (
          <div style={{ fontSize: '12px', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Showing results for "<strong style={{ color: '#0f172a' }}>{searchQuery}</strong>" —</span>
            <span style={{ color: '#EA580C', fontWeight: 800 }}>{filteredGroups.length} group{filteredGroups.length === 1 ? '' : 's'} found</span>
          </div>
        )}
      </div>

      {/* Main Content Layout */}
      <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>

        {/* Table Container - Direct View */}
        <div style={{
          background: '#FFFFFF', display: 'flex', flexDirection: 'column',
          flex: viewingGroup ? '1' : '100%', overflow: 'hidden',
          borderRadius: '8px', border: '1px solid #E2E8F0'
        }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <Loader2 size={32} color="#f97316" className="animate-spin" />
              <span style={{ fontSize: '13px', color: '#6B7280', marginTop: '12px' }}>Loading groups...</span>
            </div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center', flex: 1 }}>
              <AlertTriangle size={32} color="#EF4444" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Failed to Load Records</div>
              <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>{error}</div>
            </div>
          ) : (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
                <colgroup>
                  <col style={{ width: '55px' }} />
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '39%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '14%' }} />
                </colgroup>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ background: 'var(--brand-header, #1e1b4b)' }}>
                    <th style={{ padding: '8px 10px', fontSize: '11.5px', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'center', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>ID</th>
                    <th style={{ padding: '8px 10px', fontSize: '11.5px', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.02em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>GROUP NAME</th>
                    <th style={{ padding: '8px 10px', fontSize: '11.5px', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.02em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>ASSIGNED USERS</th>
                    <th style={{ padding: '8px 10px', fontSize: '11.5px', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'center', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>VEHICLE COUNT</th>
                    <th style={{ padding: '8px 10px', fontSize: '11.5px', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'center' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '50px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <Users2 size={40} color="#94A3B8" style={{ marginBottom: '12px' }} />
                          <div style={{ fontSize: '15px', fontWeight: 700, color: '#000000' }}>
                            {searchQuery ? `No groups found matching "${searchQuery}"` : 'No groups available'}
                          </div>
                          <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '4px', maxWidth: '420px', lineHeight: 1.4 }}>
                            {searchQuery
                              ? 'Neither group names nor any assigned vehicle numbers / plates match this query. The vehicle may not be assigned to any group.'
                              : 'Create groups to organize your fleet.'}
                          </div>
                          {searchQuery && (
                            <div style={{ marginTop: '16px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                              <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                style={{
                                  padding: '6px 14px',
                                  borderRadius: '6px',
                                  border: '1px solid #CBD5E1',
                                  background: '#FFFFFF',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  color: '#334155',
                                  cursor: 'pointer'
                                }}
                              >
                                Clear Search
                              </button>
                              <button
                                type="button"
                                onClick={() => navigate(`/admin/vehicles?search=${encodeURIComponent(searchQuery)}`)}
                                style={{
                                  padding: '6px 14px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: '#EA580C',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  color: '#FFFFFF',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <Truck size={14} />
                                <span>Check in Vehicles List</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : filteredGroups.map((g, index) => {
                    const assignedUsers = getAssignedUsers(g);
                    const vCount = g.vehicle_count || (g.vehicles ? g.vehicles.length : 0);
                    const matchingVehicles = getMatchingVehicles(g, searchQuery);
                    return (
                      <tr
                        key={g.id}
                        style={{
                          borderBottom: '1px solid #e0e7ff',
                          height: '38px',
                          background: 'transparent',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '6px 10px', fontSize: '12.5px', color: '#000000', fontWeight: 700, textAlign: 'center', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                          {index + 1}
                        </td>
                        <td style={{ padding: '8px 10px', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#000000' }}>{g.name}</div>
                          {matchingVehicles.length > 0 && (
                            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', fontWeight: 800, color: '#C2410C', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                <Truck size={12} color="#EA580C" />
                                <span>Vehicle in this group:</span>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {matchingVehicles.map(mv => (
                                  <span
                                    key={mv.id || mv.plate || mv.imei || mv.name}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      background: '#FFF7ED',
                                      color: '#C2410C',
                                      border: '1px solid #FFEDD5',
                                      padding: '2px 8px',
                                      borderRadius: '5px',
                                      fontSize: '11px',
                                      fontWeight: 800
                                    }}
                                    title={`Plate: ${mv.plate || 'N/A'} | IMEI: ${mv.imei || 'N/A'}`}
                                  >
                                    <span>{mv.plate || mv.vehicleId || mv.name}</span>
                                    {mv.name && mv.plate && mv.name.toLowerCase() !== mv.plate.toLowerCase() && (
                                      <span style={{ color: '#9A3412', fontWeight: 500, fontSize: '10.5px' }}>({mv.name})</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '6px 10px', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>
                          {(!assignedUsers || assignedUsers.length === 0) ? (
                            <span style={{ fontSize: '12.5px', color: '#000000', fontWeight: 500 }}>No users assigned</span>
                          ) : (
                            <div style={{ fontSize: '12.5px', color: '#000000', fontWeight: 600, lineHeight: 1.4, wordBreak: 'break-word' }}>
                              {assignedUsers.map(u => u.name || u.username || u.email).filter(Boolean).join(', ')}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '6px 10px', verticalAlign: 'middle', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/vehicles?groupId=${g.id}`)}
                            title={`Click to view ${vCount} vehicles in ${g.name}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '2px 10px',
                              borderRadius: '8px',
                              background: '#FFF7ED',
                              color: '#EA580C',
                              border: '1px solid #FFEDD5',
                              fontSize: '12px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = '#EA580C';
                              e.currentTarget.style.color = '#FFFFFF';
                              e.currentTarget.style.borderColor = '#EA580C';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = '#FFF7ED';
                              e.currentTarget.style.color = '#EA580C';
                              e.currentTarget.style.borderColor = '#FFEDD5';
                            }}
                          >
                            {vCount}
                          </button>
                        </td>
                        <td style={{ padding: '6px 10px', verticalAlign: 'middle', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button onClick={(e) => { e.stopPropagation(); setEditingGroup(g); setIsAddModalOpen(true); }} style={{ padding: '3px 8px', borderRadius: '6px', background: '#FFF7ED', border: '1px solid #FDBA74', color: '#EA580C', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#FFEDD5'} onMouseLeave={e => e.currentTarget.style.background = '#FFF7ED'}>
                              Edit
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g); }} style={{ padding: '3px 8px', borderRadius: '6px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#FEE2E2'} onMouseLeave={e => e.currentTarget.style.background = '#FEF2F2'}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fadeInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}} />
    </div>
  );
};

export default GroupsAdminPage;
