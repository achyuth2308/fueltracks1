import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import * as adminApi from '../../api/adminApi';

const AddUserModal = ({ isOpen, onClose, onSave, editingUser = null, orgs = [] }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('customer');
  const [orgId, setOrgId] = useState('');
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (editingUser) {
      setName(editingUser.name || '');
      setEmail(editingUser.email || '');
      setPassword(''); // Password cannot be restored
      setRole(editingUser.role || 'customer');
      setOrgId(editingUser.org_id || '');
      setSelectedGroups(editingUser.groups ? editingUser.groups.map(g => g.id) : []);
    } else {
      setName('');
      setEmail('');
      setPassword('');
      setRole('customer');
      setOrgId(orgs.length > 0 ? orgs[0].id : '');
      setSelectedGroups([]);
    }
  }, [editingUser, isOpen, orgs]);

  // Fetch groups based on orgId
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await adminApi.getGroups();
        if (response.success) {
          const activeOrg = orgId || (editingUser ? editingUser.org_id : '');
          const filtered = response.data.filter(g => g.org_id === activeOrg);
          setAvailableGroups(filtered);
        }
      } catch (err) {
        console.error('Failed to fetch groups:', err);
      }
    };

    if (isOpen) {
      fetchGroups();
    }
  }, [orgId, editingUser, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser && !password) {
      setError('Password is required for new users.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      name,
      email,
      role,
      orgId,
      groupIds: selectedGroups
    };

    if (password) {
      payload.password = password;
    }

    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save user details');
    } finally {
      setLoading(false);
    }
  };

  const handleGroupToggle = (groupId) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-800/30">
          <h3 className="font-bold text-slate-100 text-sm">
            {editingUser ? 'Update User Details' : 'Create New Account'}
          </h3>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ramesh Kumar"
              className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-blue-500 focus:outline-none rounded-lg text-slate-200 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-blue-500 focus:outline-none rounded-lg text-slate-200 transition-all"
            />
          </div>

          {!editingUser && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Password *
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-blue-500 focus:outline-none rounded-lg text-slate-200 transition-all"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Permission Role *
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-blue-500 focus:outline-none rounded-lg text-slate-200 transition-all"
              >
                <option value="customer">Customer</option>
                <option value="dealer">Dealer / Org Admin</option>
                <option value="superadmin">Super Admin</option>
              </select>
            </div>

            {orgs.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Assigned Org *
                </label>
                <select
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-blue-500 focus:outline-none rounded-lg text-slate-200 transition-all"
                >
                  {orgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Sub-fleet Groups Selector */}
          {availableGroups.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Limit Sub-fleet Group Access
              </label>
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950 border border-slate-800 rounded-lg max-h-32 overflow-y-auto">
                {availableGroups.map((group) => (
                  <label 
                    key={group.id} 
                    className="flex items-center space-x-2 text-xs text-slate-300 select-none cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(group.id)}
                      onChange={() => handleGroupToggle(group.id)}
                      className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500/20 bg-slate-900 border-slate-700"
                    />
                    <span>{group.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Footer Save buttons */}
          <div className="flex justify-end items-center space-x-3 pt-4 border-t border-slate-800/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-[0_0_12px_rgba(37,99,235,0.3)] hover:shadow-[0_0_16px_rgba(37,99,235,0.5)] transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Account'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUserModal;
