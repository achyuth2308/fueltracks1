import React, { useState, useEffect } from 'react';
import { X, Loader2, Search } from 'lucide-react';
import * as adminApi from '../../api/adminApi';

const AddUserModal = ({ isOpen, onClose, onSave, editingUser = null, orgs = [] }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('customer');
  const [orgId, setOrgId] = useState('');
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Extra UI Fields (Frontend only for layout matching)
  const [altEmail, setAltEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [zoho, setZoho] = useState('');
  const [defaultMap, setDefaultMap] = useState('OSM');
  const [enableDebugs, setEnableDebugs] = useState('Disable');
  const [assetUser, setAssetUser] = useState(false);
  const [virtualAccount, setVirtualAccount] = useState(true);
  const [groupSearch, setGroupSearch] = useState('');

  useEffect(() => {
    if (editingUser) {
      setName(editingUser.name || '');
      setEmail(editingUser.email || '');
      setPhone(editingUser.phone || '');
      setPassword(''); // Password cannot be restored
      setRole(editingUser.role || 'customer');
      setOrgId(editingUser.org_id || '');
      setSelectedGroups(editingUser.groups ? editingUser.groups.map(g => g.id) : []);
    } else {
      setName('');
      setEmail('');
      setPhone('');
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
          setAvailableGroups(response.data);
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
      phone,
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

  const handleSelectAllGroups = (e) => {
    if (e.target.checked) {
      setSelectedGroups(availableGroups.map(g => g.id));
    } else {
      setSelectedGroups([]);
    }
  };

  const filteredGroups = availableGroups.filter(g => g.name.toLowerCase().includes(groupSearch.toLowerCase()));
  const isAllSelected = availableGroups.length > 0 && selectedGroups.length === availableGroups.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex justify-between items-center px-8 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800">
              {editingUser ? 'Edit User' : 'Create User'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-8 py-6 space-y-8 bg-white">
          {error && (
            <div className="p-3 text-sm font-medium bg-red-50 text-red-600 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-8 gap-y-6">
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                User Name<span className="text-red-500">*</span>
              </label>
              <input
                type="text" required value={name} onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 text-[14px] bg-white border border-slate-300 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none rounded-lg text-slate-800 transition-all shadow-sm"
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                Mobile Number<span className="text-red-500">*</span>
              </label>
              <input
                type="text" required value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2.5 text-[14px] bg-white border border-slate-300 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none rounded-lg text-slate-800 transition-all shadow-sm"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                Email<span className="text-red-500">*</span>
              </label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 text-[14px] bg-white border border-slate-300 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none rounded-lg text-slate-800 transition-all shadow-sm"
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                Alternate Email
              </label>
              <input
                type="email" value={altEmail} onChange={(e) => setAltEmail(e.target.value)} placeholder="Alternate Email"
                className="w-full px-4 py-2.5 text-[14px] bg-white border border-slate-300 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none rounded-lg text-slate-800 transition-all shadow-sm"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                Organization<span className="text-red-500">*</span>
              </label>
              <select
                required value={orgId} onChange={(e) => setOrgId(e.target.value)}
                className="w-full px-4 py-2.5 text-[14px] bg-white border border-slate-300 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none rounded-lg text-slate-800 transition-all shadow-sm"
              >
                {orgs.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                Role<span className="text-red-500">*</span>
              </label>
              <select
                required value={role} onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-2.5 text-[14px] bg-white border border-slate-300 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none rounded-lg text-slate-800 transition-all shadow-sm"
              >
                <option value="customer">Customer</option>
                <option value="dealer">Dealer</option>
                <option value="superadmin">Super Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                Zoho<span className="text-red-500">*</span>
              </label>
              <input
                type="text" value={zoho} onChange={(e) => setZoho(e.target.value)} placeholder="Zoho"
                className="w-full px-4 py-2.5 text-[14px] bg-white border border-slate-300 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none rounded-lg text-slate-800 transition-all shadow-sm"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                Default Map
              </label>
              <select
                value={defaultMap} onChange={(e) => setDefaultMap(e.target.value)}
                className="w-full px-4 py-2.5 text-[14px] bg-white border border-slate-300 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none rounded-lg text-slate-800 transition-all shadow-sm"
              >
                <option value="OSM">OSM</option>
                <option value="Google">Google Maps</option>
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                Enable Debugs
              </label>
              <select
                value={enableDebugs} onChange={(e) => setEnableDebugs(e.target.value)}
                className="w-full px-4 py-2.5 text-[14px] bg-white border border-slate-300 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none rounded-lg text-slate-800 transition-all shadow-sm"
              >
                <option value="Disable">Disable</option>
                <option value="Enable">Enable</option>
              </select>
            </div>

            {!editingUser && (
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
                  Password<span className="text-red-500">*</span>
                </label>
                <input
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                  className="w-full px-4 py-2.5 text-[14px] bg-white border border-slate-300 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none rounded-lg text-slate-800 transition-all shadow-sm"
                />
              </div>
            )}
          </div>

          <div className="pt-2">
            <label className="block text-[14px] font-semibold text-[#3B82F6] mb-4">
              User Mode :
            </label>
            <div className="flex items-center gap-8 pl-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={assetUser} onChange={(e) => setAssetUser(e.target.checked)}
                  className="w-4 h-4 text-[#3B82F6] rounded border-slate-300 focus:ring-[#3B82F6]"
                />
                <span className="text-sm text-slate-700 font-medium">Asset User</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={virtualAccount} onChange={(e) => setVirtualAccount(e.target.checked)}
                  className="w-4 h-4 text-[#3B82F6] rounded border-slate-300 focus:ring-[#3B82F6]"
                />
                <span className="text-sm text-slate-700 font-medium">Virtual Account</span>
              </label>
            </div>
          </div>

          {/* Centered Update Button matching the screenshot */}
          <div className="flex justify-center mt-8 mb-6 border-b border-slate-100 pb-8">
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-2.5 bg-[#3B82F6] hover:bg-blue-600 text-white text-sm font-semibold rounded shadow-sm disabled:opacity-50 transition-colors flex items-center"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingUser ? 'Update User' : 'Create User'}
            </button>
          </div>

          {/* Groups Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={isAllSelected} onChange={handleSelectAllGroups}
                  className="w-4 h-4 text-[#3B82F6] rounded border-slate-300 focus:ring-[#3B82F6]"
                />
                <span className="text-sm text-black font-semibold">Select All Groups</span>
              </label>

              <div className="flex items-center">
                <input
                  type="text" value={groupSearch} onChange={(e) => setGroupSearch(e.target.value)} placeholder="Search..."
                  className="w-64 px-4 py-2 text-sm border border-slate-300 rounded-l focus:outline-none focus:border-[#3B82F6]"
                />
                <button type="button" className="px-4 py-2 bg-[#3B82F6] text-white rounded-r border border-[#3B82F6]">
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <h4 className="text-[14px] font-semibold text-black mb-3">Selected Groups:</h4>
              <div className="flex flex-wrap gap-4">
                {selectedGroups.length === 0 && <span className="text-sm text-slate-500">None</span>}
                {selectedGroups.map(gid => {
                  const g = availableGroups.find(a => a.id === gid);
                  if (!g) return null;
                  return (
                    <label key={g.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox" checked={true} onChange={() => handleGroupToggle(g.id)}
                        className="w-4 h-4 text-[#3B82F6] rounded border-slate-300 focus:ring-[#3B82F6]"
                      />
                      <span className="text-sm text-slate-700 font-medium">{g.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="text-[14px] font-semibold text-black mb-4">Select the Groups:</h4>
              {filteredGroups.length === 0 ? (
                <div className="text-[13px] text-slate-500 italic">No groups available in this organization.</div>
              ) : (
                <div className="grid grid-cols-4 gap-y-4 gap-x-2">
                  {filteredGroups.map(g => (
                    <label key={g.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox" checked={selectedGroups.includes(g.id)} onChange={() => handleGroupToggle(g.id)}
                        className="w-4 h-4 text-[#3B82F6] rounded border-slate-300 focus:ring-[#3B82F6]"
                      />
                      <span className="text-[13px] text-black uppercase font-medium">{g.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

          </div>
        </form>

      </div>
    </div>
  );
};

export default AddUserModal;
