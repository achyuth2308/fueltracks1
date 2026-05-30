import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Loader2, 
  AlertTriangle,
  UserCheck,
  Search
} from 'lucide-react';
import * as adminApi from '../../api/adminApi';
import AddUserModal from '../../components/modals/AddUserModal';
import { useAuth } from '../../hooks/useAuth';

const UsersAdminPage = () => {
  const { user } = useAuth();

  const [users, setUsers] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal / Form States
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getUsers();
      if (response.success) {
        setUsers(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch user list:', err);
      setError('Access denied or failed to load user records.');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgs = async () => {
    try {
      const response = await adminApi.getOrgs();
      if (response.success) {
        setOrgs(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch orgs:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchOrgs();
  }, []);

  const handleOpenAddModal = () => {
    setSelectedUser(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (targetUser) => {
    setSelectedUser(targetUser);
    setModalOpen(true);
  };

  const handleCreateOrUpdate = async (payload) => {
    if (selectedUser) {
      await adminApi.updateUser(selectedUser.id, payload);
    } else {
      await adminApi.createUser(payload);
    }
    fetchUsers();
  };

  const handleDelete = async (userId) => {
    if (window.confirm('Are you sure you want to suspend this user? Session tokens will be invalidated immediately.')) {
      try {
        const response = await adminApi.deleteUser(userId);
        if (response.success) {
          fetchUsers();
        }
      } catch (err) {
        console.error('Delete user failed:', err);
        alert(err.response?.data?.error || 'Failed to deactivate account.');
      }
    }
  };

  // Filter users by search query
  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-slate-950 p-6 space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center">
            <Users className="w-5 h-5 text-blue-500 mr-2" />
            <span>Accounts & Team Roster</span>
          </h2>
          <p className="text-[10px] text-slate-400 mt-0.5">Control staff user accounts, email logins, and group permissions.</p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white rounded-lg shadow-[0_0_12px_rgba(37,99,235,0.3)] hover:shadow-[0_0_16px_rgba(37,99,235,0.5)] transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span>Add Account</span>
        </button>
      </div>

      {/* Filter and Search Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search email, name..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-900 border border-slate-800 focus:border-blue-500 focus:outline-none rounded-lg text-slate-200 transition-all font-semibold"
          />
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-xs text-slate-400 font-semibold mt-3">Fetching user accounts...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
          <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <h5 className="font-bold text-slate-200 text-sm">Failed to Load Users</h5>
          <p className="text-xs text-slate-400 mt-1">{error}</p>
        </div>
      ) : (
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="text-[10px] text-slate-400 uppercase tracking-wider bg-slate-950/60 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Full Name</th>
                  <th className="px-4 py-3">Email Address</th>
                  <th className="px-4 py-3">Assigned Role</th>
                  <th className="px-4 py-3">Organization Workspace</th>
                  <th className="px-4 py-3">Account Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-slate-500 italic">
                      No accounts found. Create a new roster card.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((targetUser) => (
                    <tr key={targetUser.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-bold text-slate-100 flex items-center">
                        <UserCheck className="w-4 h-4 text-slate-500 mr-2" />
                        <span>{targetUser.name || 'Unnamed'}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400">{targetUser.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-wider ${
                          targetUser.role === 'superadmin'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : targetUser.role === 'dealer'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-green-500/10 text-green-400 border border-green-500/20'
                        }`}>
                          {targetUser.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-semibold">{targetUser.org_name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-wider ${
                          targetUser.is_active 
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {targetUser.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenEditModal(targetUser)}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-all"
                            title="Edit permissions"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            disabled={targetUser.id === user?.id}
                            onClick={() => handleDelete(targetUser.id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-all disabled:opacity-20"
                            title="Suspend account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit User Modal */}
      <AddUserModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreateOrUpdate}
        editingUser={selectedUser}
        orgs={orgs}
      />
    </div>
  );
};

export default UsersAdminPage;
