import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Loader2, AlertTriangle, Search, ChevronRight, User as UserIcon, Building2, Truck, Users2, X } from 'lucide-react';
import * as adminApi from '../../api/adminApi';
import { getUserVehicles } from '../../api/adminApi';
import AddUserModal from '../../components/modals/AddUserModal';
import { useAuth } from '../../hooks/useAuth';

const UsersAdminPage = () => {
  const { user } = useAuth();

  const [users, setUsers] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);

  // Details Panel State
  const [viewingUser, setViewingUser] = useState(null);
  const [userVehicles, setUserVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getUsers();
      if (response.success) {
        setUsers(response.data);
      }
    } catch (err) {
      setError('Failed to load user records.');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgs = async () => {
    try {
      const response = await adminApi.getOrgs();
      if (response.success) setOrgs(response.data);
    } catch (err) { }
  };

  useEffect(() => {
    fetchUsers();
    fetchOrgs();
  }, []);

  const handleViewUser = async (u) => {
    setViewingUser(u);
    setUserVehicles([]);
    setVehiclesLoading(true);
    try {
      const res = await getUserVehicles(u.id);
      if (res.success) setUserVehicles(res.data);
    } catch (e) {
      setUserVehicles([]);
    } finally {
      setVehiclesLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setSelectedUserForEdit(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (targetUser, e) => {
    if (e) e.stopPropagation();
    setSelectedUserForEdit(targetUser);
    setModalOpen(true);
  };

  const handleCreateOrUpdate = async (payload) => {
    if (selectedUserForEdit) {
      await adminApi.updateUser(selectedUserForEdit.id, payload);
      if (viewingUser && viewingUser.id === selectedUserForEdit.id) {
        setViewingUser({ ...viewingUser, ...payload });
      }
    } else {
      await adminApi.createUser(payload);
    }
    fetchUsers();
  };

  const handleDelete = async (userId, e) => {
    if (e) e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const response = await adminApi.deleteUser(userId);
        if (response.success) {
          if (viewingUser?.id === userId) setViewingUser(null);
          fetchUsers();
        }
      } catch (err) {
        alert('Failed to delete account.');
      }
    }
  };

  const filteredUsers = users.filter(u =>
    u.role !== 'superadmin' &&
    (u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     u.email?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ padding: '32px', background: 'linear-gradient(to bottom, #f5efe4 0%, #f5efe4 50%, #F8FAFC 50%, #F8FAFC 100%)', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>Users Directory</h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>Manage system access, roles, and group assignments.</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#5B21B6', color: '#FFFFFF',
            padding: '10px 20px', borderRadius: '10px',
            fontSize: '14px', fontWeight: 600, border: 'none',
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(91,33,182,0.2)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(91,33,182,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(91,33,182,0.2)'; }}
        >
          <Plus size={18} />
          <span>New User</span>
        </button>
      </div>

      <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>

        {/* Left Side: List */}
        <div style={{
          background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
          boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column',
          flex: viewingUser ? '1' : '100%', transition: 'all 0.3s ease', overflow: 'hidden'
        }}>
          {/* Search Bar */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
              <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} size={16} />
              <input
                type="text"
                placeholder="Search name or email..."
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
              <Loader2 size={32} color="#8ba0b5" className="animate-spin" />
              <span style={{ fontSize: '14px', color: '#6B7280', marginTop: '12px' }}>Loading users...</span>
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
                  <tr style={{ background: '#f5efe4', borderBottom: '1px solid #E2E8F0' }}>
                    {['Name', 'Contact', 'Groups', 'Role', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#6B7280', fontSize: '14px' }}>No users found.</td>
                    </tr>
                  ) : filteredUsers.map((u) => (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        background: viewingUser?.id === u.id ? '#f5efe4' : 'transparent',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => { if (viewingUser?.id !== u.id) e.currentTarget.style.background = '#f5efe4'; }}
                      onMouseLeave={e => { if (viewingUser?.id !== u.id) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{u.name || 'Unnamed'}</div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontSize: '13px', color: '#111827' }}>
                          {u.phone || '—'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6B7280' }}>
                          {u.email || '—'}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569', fontWeight: 500 }}>
                        {u.group_names ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {u.group_names.split(', ').map((gName, i) => (
                              <span key={i} style={{ padding: '2px 8px', background: '#F1F5F9', borderRadius: '4px', fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                                {gName}
                              </span>
                            ))}
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 700, textTransform: 'capitalize',
                          background: '#F1F5F9', color: '#475569'
                        }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
                          background: u.is_active ? '#D1FAE5' : '#FEE2E2',
                          color: u.is_active ? '#059669' : '#DC2626'
                        }}>
                          {u.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleViewUser(u)}
                            style={{
                              background: '#F1F5F9', color: '#475569', border: 'none', padding: '6px 12px',
                              borderRadius: '6px', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', cursor: 'pointer',
                            }}
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            style={{
                              background: '#5B21B6', color: 'white', border: 'none', padding: '6px 12px',
                              borderRadius: '6px', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', cursor: 'pointer',
                              boxShadow: '0 2px 4px rgba(91,33,182,0.1)'
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(u.id)}
                            style={{
                              background: '#FEF2F2', color: '#DC2626', border: '1px solid #FEE2E2', padding: '6px 12px',
                              borderRadius: '6px', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', cursor: 'pointer'
                            }}
                          >
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

        {/* Right Side: Details Panel */}
        {viewingUser && (
          <div style={{
            width: '380px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
            boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', animation: 'fadeInRight 0.3s ease'
          }}>
            {/* Details Header */}
            <div style={{ padding: '24px', borderBottom: '1px solid #F1F5F9', position: 'relative' }}>
              <button
                onClick={() => setViewingUser(null)}
                style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>

              <div style={{
                width: '64px', height: '64px', borderRadius: '16px', background: '#f5efe4',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px'
              }}>
                <UserIcon size={32} color="#8ba0b5" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', marginBottom: '4px' }}>{viewingUser.name || 'Unnamed User'}</h2>
              <div style={{ fontSize: '13px', color: '#6B7280', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span>{viewingUser.email}</span>
                {viewingUser.phone && <span>{viewingUser.phone}</span>}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button onClick={(e) => handleOpenEditModal(viewingUser, e)} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#f5efe4', border: '1px solid #E2E8F0', color: '#111827', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}>
                  <Edit size={14} /> Edit User
                </button>
                {user?.id !== viewingUser.id && (
                  <button onClick={(e) => handleDelete(viewingUser.id, e)} style={{ padding: '10px', borderRadius: '8px', background: '#FEF2F2', border: '1px solid #FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Details Content */}
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

              <div>
                <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Access & Permissions</h3>
                <div style={{ background: '#f5efe4', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E2E8F0' }}><Building2 size={16} color="#64748B" /></div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Organization</div>
                      <div style={{ fontSize: '13px', color: '#111827', fontWeight: 700 }}>{viewingUser.org_name || 'None'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E2E8F0' }}><Users2 size={16} color="#64748B" /></div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Assigned Groups</div>
                      <div style={{ fontSize: '13px', color: '#111827', fontWeight: 700 }}>{viewingUser.group_names || '—'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E2E8F0', flexShrink: 0, marginTop: '2px' }}><Truck size={16} color="#64748B" /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, marginBottom: '6px' }}>Accessible Vehicles</div>
                      {vehiclesLoading ? (
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>Loading...</div>
                      ) : userVehicles.length === 0 ? (
                        <div style={{ fontSize: '13px', color: '#111827', fontWeight: 700 }}>—</div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {userVehicles.map(v => (
                            <span key={v.id} style={{
                              padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                              background: v.is_online ? '#D1FAE5' : '#F1F5F9',
                              color: v.is_online ? '#059669' : '#475569'
                            }}>
                              {v.name}{v.plate ? ` (${v.plate})` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Account Status</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>Status</span>
                  <span style={{ fontSize: '13px', color: viewingUser.is_active ? '#059669' : '#DC2626', fontWeight: 700 }}>{viewingUser.is_active ? 'Active' : 'Suspended'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                  <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>System Role</span>
                  <span style={{ fontSize: '13px', color: '#111827', fontWeight: 700, textTransform: 'capitalize' }}>{viewingUser.role}</span>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      <AddUserModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreateOrUpdate}
        editingUser={selectedUserForEdit}
        orgs={orgs}
      />
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

export default UsersAdminPage;
