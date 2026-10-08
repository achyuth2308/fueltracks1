import React, { useState, useEffect } from 'react';
import { Users2, Plus, Edit, Trash2, Loader2, AlertTriangle, Search, ChevronRight, Building2, User, Truck, X } from 'lucide-react';
import * as adminApi from '../../api/adminApi';
import AddGroupModal from '../../components/modals/AddGroupModal';

const GroupsAdminPage = () => {
  const [groups, setGroups] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [viewingGroup, setViewingGroup] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [groupsRes, orgsRes] = await Promise.all([
        adminApi.getGroups({ t: Date.now() }),
        adminApi.getOrgs().catch(() => ({ success: false, data: [] }))
      ]);
      if (groupsRes.success) setGroups(groupsRes.data);
      if (orgsRes.success) setOrgs(orgsRes.data);
    } catch (err) {
      setError('Failed to load group records. You may not have access.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveGroup = async (groupData) => {
    if (editingGroup) {
      await adminApi.updateGroup(editingGroup.id, groupData);
      setViewingGroup(prev => prev && prev.id === editingGroup.id ? { ...prev, name: groupData.name, org_id: groupData.orgId } : prev);
    } else {
      await adminApi.createGroup(groupData);
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

  const filteredGroups = groups.filter(g =>
    (g.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="pastel-page-bg" style={{ padding: '16px 20px', height: '100%', display: 'flex', flexDirection: 'column', gap: '10px', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Groups Management</h1>
          <p style={{ fontSize: '12px', color: '#475569', margin: '2px 0 0 0' }}>Organize fleets into operational zones and assign user access.</p>
        </div>
        <button
          onClick={() => { setEditingGroup(null); setIsAddModalOpen(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: '#f97316', color: '#FFFFFF',
            padding: '6px 12px', borderRadius: '8px',
            fontSize: '12px', fontWeight: 700, border: 'none',
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(249,115,22,0.25)',
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
      <div style={{ background: '#FFFFFF', padding: '8px 12px', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '8px' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
          <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} size={15} />
          <input
            type="text"
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '6px 10px 6px 32px',
              borderRadius: '6px', border: '1px solid #CBD5E1',
              fontSize: '12px', outline: 'none', color: '#0F172A', boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* Main Content Layout */}
      <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>

        {/* Table Container - Direct View */}
        <div style={{
          background: '#FFFFFF', display: 'flex', flexDirection: 'column',
          flex: viewingGroup ? '1' : '100%', overflow: 'hidden'
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
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ background: '#1e1b4b' }}>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em', width: '50px', textAlign: 'center', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>ID</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em', width: '220px', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>GROUP NAME</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>ASSIGNED VEHICLES</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em', width: '130px', textAlign: 'center', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>VEHICLE COUNT</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em', width: '130px', textAlign: 'center' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '60px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.6 }}>
                          <Users2 size={40} color="#94A3B8" style={{ marginBottom: '12px' }} />
                          <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>No groups available</div>
                          <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '2px' }}>Create groups to organize your fleet.</div>
                        </div>
                      </td>
                    </tr>
                  ) : filteredGroups.map((g, index) => (
                    <tr
                      key={g.id}
                      style={{
                        borderBottom: '1px solid #e0e7ff',
                        background: 'transparent',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '8px 12px', fontSize: '12px', color: '#64748b', fontWeight: 700, textAlign: 'center', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                        {index + 1}
                      </td>
                      <td style={{ padding: '8px 12px', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{g.name}</div>
                        {g.org_name && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#475569', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', marginTop: '2px', fontWeight: 600 }}>
                            <Building2 size={10} color="#64748b" /> {g.org_name}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>
                        {(!g.vehicles || g.vehicles.length === 0) ? (
                          <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>No vehicles assigned</span>
                        ) : (
                          <div style={{ fontSize: '12px', color: '#1e293b', fontWeight: 600, lineHeight: 1.4 }}>
                            {g.vehicles.map(v => v.name || v.vehicleId).filter(Boolean).join(', ')}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', verticalAlign: 'middle', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', background: '#e0e7ff', color: '#3730a3', fontSize: '12px', fontWeight: 800 }}>
                          {g.vehicle_count || (g.vehicles ? g.vehicles.length : 0)}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button onClick={(e) => { e.stopPropagation(); setEditingGroup(g); setIsAddModalOpen(true); }} style={{ padding: '4px 10px', borderRadius: '6px', background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4338CA', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#C7D2FE'} onMouseLeave={e => e.currentTarget.style.background = '#EEF2FF'}>
                            Edit
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g); }} style={{ padding: '4px 10px', borderRadius: '6px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#FEE2E2'} onMouseLeave={e => e.currentTarget.style.background = '#FEF2F2'}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
