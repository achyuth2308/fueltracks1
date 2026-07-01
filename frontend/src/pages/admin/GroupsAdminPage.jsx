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
    g.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: '32px', background: '#EEF5F8', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>Groups Management</h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>Organize fleets into operational zones and assign user access.</p>
        </div>
        <button
          onClick={() => { setEditingGroup(null); setIsAddModalOpen(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#f97316', color: '#FFFFFF',
            padding: '10px 20px', borderRadius: '10px',
            fontSize: '14px', fontWeight: 600, border: 'none',
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(249,115,22,0.25)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(249,115,22,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(249,115,22,0.25)'; }}
        >
          <Plus size={18} />
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

      <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>

        {/* Left Side: List */}
        <div style={{
          background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
          boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column',
          flex: viewingGroup ? '1' : '100%', transition: 'all 0.3s ease', overflow: 'hidden'
        }}>
          {/* Search Bar */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
              <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} size={16} />
              <input
                type="text"
                placeholder="Search groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px 10px 38px',
                  borderRadius: '10px', border: '1px solid #CBD5E1',
                  fontSize: '14px', outline: 'none', color: '#111827', boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <Loader2 size={32} color="#f97316" className="animate-spin" />
              <span style={{ fontSize: '14px', color: '#6B7280', marginTop: '12px' }}>Loading groups...</span>
            </div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center', flex: 1 }}>
              <AlertTriangle size={32} color="#EF4444" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Failed to Load Records</div>
              <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>{error}</div>
            </div>
          ) : (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ w: '100%', width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    {['ID', 'Group Name', 'Vehicle Id', 'Vehicle Name', 'Vehicle Count', 'Action'].map(h => (
                      <th key={h} style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '80px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.5 }}>
                          <Users2 size={48} color="#94A3B8" style={{ marginBottom: '16px' }} />
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>No groups available</div>
                          <div style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>Create groups to organize your fleet.</div>
                        </div>
                      </td>
                    </tr>
                  ) : filteredGroups.map((g, index) => (
                    <tr
                      key={g.id}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        background: 'transparent',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>
                        {index + 1}
                      </td>
                      <td style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{g.name}</div>
                        {g.org_name && <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>Org: {g.org_name}</div>}
                      </td>
                      <td style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {(g.vehicles || []).map((v, i) => (
                            <div key={i} style={{ fontSize: '13px', fontWeight: 500, color: '#475569' }}>{v.vehicleId || '—'}</div>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {(g.vehicles || []).map((v, i) => (
                            <div key={i} style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{v.name || '—'}</div>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, color: '#475569', verticalAlign: 'top', textAlign: 'center' }}>
                        {g.vehicle_count || 0}
                      </td>
                      <td style={{ padding: '16px 20px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={(e) => { e.stopPropagation(); setEditingGroup(g); setIsAddModalOpen(true); }} style={{ padding: '6px 12px', borderRadius: '6px', background: '#F1F5F9', border: 'none', color: '#475569', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#E2E8F0'} onMouseLeave={e => e.currentTarget.style.background = '#F1F5F9'}>
                            Edit
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g); }} style={{ padding: '6px 12px', borderRadius: '6px', background: '#EF4444', border: 'none', color: '#FFFFFF', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#DC2626'} onMouseLeave={e => e.currentTarget.style.background = '#EF4444'}>
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
