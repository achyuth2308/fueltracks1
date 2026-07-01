import React, { useState } from 'react';
import { Save, Loader2, ShieldCheck, Clock, Monitor } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';

const SecurityTab = ({ onChangePassword }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    const res = await onChangePassword({
      currentPassword: formData.currentPassword,
      newPassword: formData.newPassword
    });

    if (res.success) {
      setSuccess('Password updated successfully! Please use this password on your next login.');
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setSuccess(''), 5000);
    } else {
      setError(res.error || 'Failed to update password');
    }
    setLoading(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      <div className="lg:col-span-2">
        <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-10 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200">
          <div className="flex items-center mb-6 border-b pb-4">
            <ShieldCheck className="w-5 h-5 mr-2" style={{ color: "#000000" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#000000", margin: 0, letterSpacing: "-0.01em" }}>Change Password</h2>
          </div>

          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}
          {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md text-sm">{success}</div>}

          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-[13px] font-bold uppercase tracking-wide mb-1" style={{ color: "#000000" }}>Current Password</label>
              <input
                type="password"
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm  focus:outline-none focus:border-[#f97316] focus:ring-4 focus:ring-[#f97316]/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-[13px] font-bold uppercase tracking-wide mb-1" style={{ color: "#000000" }}>New Password</label>
              <input
                type="password"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm  focus:outline-none focus:border-[#f97316] focus:ring-4 focus:ring-[#f97316]/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-[13px] font-bold uppercase tracking-wide mb-1" style={{ color: "#000000" }}>Confirm New Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm  focus:outline-none focus:border-[#f97316] focus:ring-4 focus:ring-[#f97316]/10 transition-all"
              />
            </div>
          </div>

          <div className="mt-6">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center px-4 py-2 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 shadow-[0_4px_12px_rgba(249,115,22,0.3)] transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#f97316] disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Update Password
            </button>
          </div>
        </form>
      </div>

      <div className="lg:col-span-1">
        <div className="bg-white p-6 sm:p-10 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200">
          <h3 className="text-sm font-semibold mb-4 border-b pb-2" style={{ color: '#000000' }}>Session Information</h3>

          <div className="space-y-4">
            <div className="flex items-start">
              <Clock className="w-4 h-4 mr-3 mt-0.5" style={{ color: '#000000' }} />
              <div>
                <p className="text-xs font-medium" style={{ color: '#000000' }}>Account Created</p>
                <p className="text-sm font-semibold" style={{ color: '#000000' }}>{user?.createdAt ? formatLocalTime(user.createdAt) : 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-start">
              <Monitor className="w-4 h-4 mr-3 mt-0.5" style={{ color: '#000000' }} />
              <div>
                <p className="text-xs font-medium" style={{ color: '#000000' }}>Current Session Role</p>
                <p className="text-sm font-semibold capitalize" style={{ color: '#000000' }}>{user?.role || 'Unknown'}</p>
              </div>
            </div>
            <div className="p-3 bg-yellow-50 rounded-md mt-4 border border-yellow-100">
              <p className="text-xs text-yellow-800">For security reasons, any password change will generate an audit record. Make sure to use a strong password containing letters, numbers, and symbols.</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default SecurityTab;
