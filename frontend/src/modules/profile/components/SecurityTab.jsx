import React, { useState } from 'react';
import { formatLocalTime } from '../../../utils/dateUtils';
import { Save, Loader2, ShieldCheck, Clock, Monitor, KeyRound, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';

const InputField = ({ label, name, type = 'text', required, placeholder, value, onChange }) => (
  <div className="flex flex-col mb-5">
    <label className="text-[14px] font-medium !text-black mb-[8px]">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value || ''}
      onChange={onChange}
      required={required}
      placeholder={placeholder}
      className="h-[48px] w-full px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[15px] font-medium !text-black focus:outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-red-500/10 hover:border-[#D1D5DB] transition-all"
    />
  </div>
);

const SectionHeader = ({ icon: Icon, title, description, tint = 'bg-red-50', iconColor = 'text-red-600' }) => (
  <div className={`mb-5 pb-4 border-b border-[#E5E7EB] ${tint} -mx-[24px] px-[24px] -mt-[24px] pt-[24px] rounded-t-[14px]`}>
    <div className="flex items-center gap-3 mb-1">
      <div className={`p-2.5 bg-white rounded-xl shadow-sm flex items-center justify-center`}>
        <Icon className={`w-[22px] h-[22px] ${iconColor}`} />
      </div>
      <h3 className="text-[20px] font-semibold !text-black m-0">{title}</h3>
    </div>
    <p className="text-[14px] !text-black m-0 pl-[52px]">{description}</p>
  </div>
);

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
  const [isDirty, setIsDirty] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setIsDirty(true);
  };

  const handleReset = () => {
    setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setError('');
    setSuccess('');
    setIsDirty(false);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
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
      setIsDirty(false);
      setTimeout(() => setSuccess(''), 5000);
    } else {
      setError(res.error || 'Failed to update password');
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-[20px] items-start w-full relative pb-[100px]">

      {/* Main Content Area (~68% of the remaining 80% page space) */}
      <div className="w-full lg:w-[68%]">

        {/* Alerts */}
        {error && <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-[14px] text-[14px] mb-[20px] shadow-sm font-medium">{error}</div>}
        {success && <div className="p-4 bg-[#ECFDF5] border border-green-200 text-[#16A34A] rounded-[14px] text-[14px] mb-[20px] shadow-sm font-medium">{success}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-[20px]">

          <div className="bg-[#FFFFFF] p-[24px] pt-0 rounded-[14px] border border-[#E5E7EB] shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow">
            <SectionHeader icon={KeyRound} title="Change Password" description="Update your authentication credentials securely." />

            <div className="max-w-md mt-[24px]">
              <InputField
                label="Current Password"
                name="currentPassword"
                type="password"
                required
                value={formData.currentPassword}
                onChange={handleChange}
              />
              <InputField
                label="New Password"
                name="newPassword"
                type="password"
                required
                value={formData.newPassword}
                onChange={handleChange}
              />
              <InputField
                label="Confirm New Password"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
              />
            </div>

            <div className="p-4 bg-red-50 border border-red-200 rounded-[10px] mt-4 flex items-start gap-3 shadow-sm">
              <AlertTriangle className="w-[20px] h-[20px] text-red-600 shrink-0 mt-0.5" />
              <p className="text-[14px] font-medium text-red-800 leading-relaxed m-0">
                For security reasons, any password change will generate an audit record. Make sure to use a strong password containing letters, numbers, and symbols.
              </p>
            </div>
          </div>

          {/* Natural Actions */}
          <div className="flex justify-end gap-3 mt-4">

            <button
              type="submit"
              disabled={loading || !formData.currentPassword || !formData.newPassword || !formData.confirmPassword}
              className="px-6 h-[48px] flex items-center justify-center text-[15px] font-semibold text-white bg-gradient-to-r from-red-600 to-red-500 rounded-[10px] shadow-[0_4px_12px_rgba(239,68,68,0.3)] hover:shadow-[0_6px_16px_rgba(239,68,68,0.4)] transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {loading ? <Loader2 className="w-[20px] h-[20px] mr-2 animate-spin" /> : <Save className="w-[20px] h-[20px] mr-2" />}
              Update Password
            </button>
          </div>
        </form>
      </div>

      {/* Right Information Panel (~32% of the remaining 80% page space) */}
      <div className="w-full lg:w-[32%] flex-shrink-0">
        <div className="bg-[#FFFFFF] p-[24px] rounded-[14px] border border-[#E5E7EB] shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow sticky top-[24px]">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-red-50 -mx-[24px] px-[24px] -mt-[24px] pt-[20px] bg-red-50 rounded-t-[14px]">
            <div className="p-1.5 bg-white rounded-lg shadow-sm border border-red-100">
              <ShieldCheck className="w-[18px] h-[18px] text-red-600" />
            </div>
            <h3 className="text-[16px] font-semibold !text-black m-0">Session Information</h3>
          </div>

          <div className="space-y-4 mt-[16px]">
            <div className="flex items-start gap-3 pb-4 border-b border-[#E5E7EB]">
              <div className="p-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg mt-0.5">
                <Clock className="w-4 h-4 text-[#6B7280]" />
              </div>
              <div>
                <h4 className="text-[13px] font-semibold !text-black uppercase tracking-wider">Account Created</h4>
                <p className="text-[16px] font-bold !text-black mt-1">{user?.createdAt ? formatLocalTime(user.createdAt) : 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg mt-0.5">
                <Monitor className="w-4 h-4 text-[#6B7280]" />
              </div>
              <div>
                <h4 className="text-[13px] font-semibold !text-black uppercase tracking-wider">Current Role</h4>
                <p className="text-[16px] font-bold !text-black mt-1 capitalize">{user?.role || 'Unknown'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityTab;