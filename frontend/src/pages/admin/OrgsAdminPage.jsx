import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { 
  Building2, 
  Plus, 
  Trash2, 
  Edit, 
  Loader2, 
  AlertTriangle,
  X,
  Building
} from 'lucide-react';
import * as adminApi from '../../api/adminApi';
import { useAuth } from '../../hooks/useAuth';

const OrgsAdminPage = () => {
  const { user } = useAuth();

  // Guard access - Superadmin only
  if (user?.role !== 'superadmin') {
    return <Navigate to="/dashboard" replace />;
  }

  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal / Form States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('customer');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [parentId, setParentId] = useState('');
  const [modalError, setModalError] = useState(null);

  const fetchOrgs = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getOrgs();
      if (response.success) {
        setOrgs(response.data);
      }
    } catch (err) {
      console.error('Failed to load orgs:', err);
      setError('Failed to fetch organization directories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const handleOpenAddModal = () => {
    setEditingOrg(null);
    setName('');
    setType('customer');
    setAddress('');
    setPhone('');
    setParentId('');
    setModalError(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (org) => {
    setEditingOrg(org);
    setName(org.name || '');
    setType(org.type || 'customer');
    setAddress(org.address || '');
    setPhone(org.phone || '');
    setParentId(org.parent_id || '');
    setModalError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) {
      setModalError('Organization name is required.');
      return;
    }

    const payload = { name, type, address, phone };
    if (parentId) payload.parentId = parentId;

    try {
      if (editingOrg) {
        await adminApi.updateOrg(editingOrg.id, payload);
      } else {
        await adminApi.createOrg(payload);
      }
      setModalOpen(false);
      fetchOrgs();
    } catch (err) {
      setModalError(err.response?.data?.error || 'Failed to save organization records.');
    }
  };

  const handleDelete = async (orgId) => {
    if (window.confirm('Are you sure you want to deactivate this organization? Users and vehicles under this workspace will be suspended.')) {
      try {
        const response = await adminApi.deleteOrg(orgId);
        if (response.success) {
          fetchOrgs();
        }
      } catch (err) {
        console.error('Delete organization failed:', err);
        alert(err.response?.data?.error || 'Failed to delete organization.');
      }
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-slate-950 p-6 space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center">
            <Building2 className="w-5 h-5 text-blue-500 mr-2" />
            <span>Multi-Tenant Organizations Directory</span>
          </h2>
          <p className="text-[10px] text-slate-400 mt-0.5">Manage Super, Dealer, and Customer workspace hierarchies.</p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white rounded-lg shadow-[0_0_12px_rgba(37,99,235,0.3)] hover:shadow-[0_0_16px_rgba(37,99,235,0.5)] transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span>Add Workspace</span>
        </button>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-xs text-slate-400 font-semibold mt-3">Fetching workspace mappings...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
          <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <h5 className="font-bold text-slate-200 text-sm">Failed to Load Workspaces</h5>
          <p className="text-xs text-slate-400 mt-1">{error}</p>
        </div>
      ) : (
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="text-[10px] text-slate-400 uppercase tracking-wider bg-slate-950/60 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Workspace Name</th>
                  <th className="px-4 py-3">Tenant Type</th>
                  <th className="px-4 py-3">Parent Organization</th>
                  <th className="px-4 py-3">Connected Vehicles</th>
                  <th className="px-4 py-3">Active Users</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {orgs.map((org) => (
                  <tr key={org.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-bold text-slate-100 flex items-center">
                      <Building className="w-4 h-4 text-slate-500 mr-2" />
                      <span>{org.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-wider ${
                        org.type === 'super' 
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                          : org.type === 'dealer'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'bg-green-500/10 text-green-400 border border-green-500/20'
                      }`}>
                        {org.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-400">{org.parent_name || '—'}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-200">{org.vehicle_count || 0}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-200">{org.user_count || 0}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleOpenEditModal(org)}
                          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-all"
                          title="Edit workspace metadata"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          disabled={org.type === 'super'}
                          onClick={() => handleDelete(org.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-all disabled:opacity-20"
                          title="Deactivate workspace"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Workspace Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-800/30">
              <h3 className="font-bold text-slate-100 text-sm">
                {editingOrg ? 'Edit Workspace Records' : 'Register Multi-Tenant Workspace'}
              </h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Workspace Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. ABC Logistics"
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-blue-500 focus:outline-none rounded-lg text-slate-200 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Tenant Type *
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-blue-500 focus:outline-none rounded-lg text-slate-200 transition-all"
                  >
                    <option value="customer">Customer</option>
                    <option value="dealer">Dealer</option>
                    <option value="super">Platform Super</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Parent Workspace
                  </label>
                  <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-blue-500 focus:outline-none rounded-lg text-slate-200 transition-all"
                  >
                    <option value="">None (Top-Level)</option>
                    {orgs
                      .filter(o => o.id !== editingOrg?.id && o.type !== 'customer')
                      .map(o => (
                        <option key={o.id} value={o.id}>
                          {o.name} ({o.type})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Business Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 99999 99999"
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-blue-500 focus:outline-none rounded-lg text-slate-200 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Business Address
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street details..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-blue-500 focus:outline-none rounded-lg text-slate-200 transition-all h-20 resize-none"
                />
              </div>

              {/* Footer Save buttons */}
              <div className="flex justify-end items-center space-x-3 pt-4 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow transition-all"
                >
                  Save Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgsAdminPage;
