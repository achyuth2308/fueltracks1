import React, { useState } from 'react';
import { formatLocalTime } from '../../../utils/dateUtils';
import { 
  Save, Loader2, ShieldCheck, Clock, Monitor, KeyRound, 
  AlertTriangle, Sparkles, Eye, EyeOff, CheckCircle2, User, Mail
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';

const InputField = ({ label, name, type = 'text', required, placeholder, value, onChange, showToggle, onToggleShow, helperText, primaryColor = '#0284C7' }) => (
  <div className="flex flex-col mb-4">
    <label className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2 flex items-center justify-between">
      <span>{label} {required && <span className="text-red-500">*</span>}</span>
      {helperText && <span className="text-[11px] font-bold text-slate-500">{helperText}</span>}
    </label>
    <div className="relative">
      <input
        type={type}
        name={name}
        value={value || ''}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className="h-12 w-full px-4 pr-11 bg-slate-50 border-2 border-slate-300 rounded-2xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-500/15 transition-all"
      />
      {showToggle && (
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 focus:outline-none p-1"
        >
          {type === 'password' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      )}
    </div>
  </div>
);

const SecurityTab = ({ onChangePassword, profile, isSuperAdmin = false }) => {
  const { user } = useAuth();
  const isManagingOtherAccount = isSuperAdmin || user?.role === 'superadmin';

  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let generated = '';
    for (let i = 0; i < 12; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({
      ...prev,
      newPassword: generated,
      confirmPassword: generated
    }));
    setShowPassword(true);
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

    const payload = {
      newPassword: formData.newPassword
    };

    // Only include currentPassword if not superadmin managing an account
    if (!isManagingOtherAccount) {
      payload.currentPassword = formData.currentPassword;
    }

    const res = await onChangePassword(payload);

    if (res.success) {
      setSuccess(
        isManagingOtherAccount 
          ? 'Dealer account password updated successfully! The dealer can now sign in with this new password.' 
          : 'Password updated successfully! Please use this password on your next login.'
      );
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setSuccess(''), 6000);
    } else {
      setError(res.error || 'Failed to update password');
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start w-full relative pb-28">
      {/* Main Content Area */}
      <div className="w-full lg:w-[65%] flex flex-col gap-6">
        {/* Alerts */}
        {error && (
          <div className="p-4 bg-red-50/90 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold shadow-sm flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-50/90 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold shadow-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="bg-white p-7 rounded-3xl border border-slate-200/90 shadow-sm">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-xs">
                  <KeyRound className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-wide m-0" style={{ color: '#0F172A' }}>
                    {isManagingOtherAccount ? 'Provision Workspace Sign-In Password' : 'Change Your Password'}
                  </h3>
                  <p className="text-xs text-slate-600 font-semibold m-0 mt-0.5">
                    {isManagingOtherAccount 
                      ? 'Directly set or reset authentication credentials for this managed workspace' 
                      : 'Update your personal credentials securely'}
                  </p>
                </div>
              </div>

              {isManagingOtherAccount && (
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-black rounded-2xl flex items-center gap-1.5 transition-colors border border-emerald-200 shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-Generate</span>
                </button>
              )}
            </div>

            {/* Super Admin Direct Reset Banner */}
            {isManagingOtherAccount && (
              <div className="p-4.5 bg-blue-50/80 border border-blue-200/80 text-blue-900 rounded-2xl text-xs mb-6 flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="font-bold block mb-0.5">Super Admin Direct Credential Management:</strong>
                  You do not need to supply the previous password. Setting a new password will instantly take effect across all portal login endpoints.
                </div>
              </div>
            )}

            <div className="max-w-md space-y-3">
              {/* Only show Current Password if user is updating their own account and NOT Super Admin managing a workspace */}
              {!isManagingOtherAccount && (
                <InputField
                  label="Current Master Password"
                  name="currentPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter current password"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  showToggle
                  onToggleShow={() => setShowPassword(!showPassword)}
                />
              )}

              <InputField
                label="New Password"
                name="newPassword"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Minimum 8 characters"
                value={formData.newPassword}
                onChange={handleChange}
                showToggle
                onToggleShow={() => setShowPassword(!showPassword)}
                helperText="Min 8 chars"
              />

              <InputField
                label="Confirm New Password"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Re-type new password"
                value={formData.confirmPassword}
                onChange={handleChange}
                showToggle
                onToggleShow={() => setShowPassword(!showPassword)}
              />
            </div>

            <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl mt-6 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-amber-900 leading-relaxed m-0">
                All credential changes are securely timestamped and recorded in the system compliance Audit Trail.
              </p>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !formData.newPassword || !formData.confirmPassword || (!isManagingOtherAccount && !formData.currentPassword)}
              style={{ backgroundColor: profile?.primary_color || '#0284C7' }}
              className="px-8 h-12 flex items-center justify-center text-xs font-extrabold text-white rounded-2xl shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {isManagingOtherAccount ? 'Save Workspace Password' : 'Update My Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Right Information Panel */}
      <div className="w-full lg:w-[35%] flex flex-col gap-6 sticky top-8">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-lg">
          <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
            <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-extrabold text-slate-900 m-0" style={{ color: '#0F172A' }}>Account Identity</h4>
          </div>

          <div className="space-y-4 text-xs font-medium">
            <div className="flex items-start gap-3.5 pb-4 border-b border-slate-100">
              <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl">
                <User className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Target Workspace</span>
                <span className="text-sm font-black text-slate-900 block mt-0.5">
                  {profile?.brand_name || profile?.org_name || profile?.name || 'Workspace Account'}
                </span>
                <span className="text-slate-500 block text-[11px] mt-0.5">
                  Contact: {profile?.contact_person || 'Workspace Administrator'}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3.5 pb-4 border-b border-slate-100">
              <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl">
                <Mail className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Login Email</span>
                <span className="text-xs font-bold text-slate-800 block mt-0.5">
                  {profile?.email || user?.email || 'N/A'}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl">
                <Monitor className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Account Role</span>
                <span className="text-xs font-black uppercase block mt-0.5" style={{ color: profile?.primary_color || '#0284C7' }}>
                  {isManagingOtherAccount ? 'Managed Workspace' : (user?.role || 'Customer')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityTab;