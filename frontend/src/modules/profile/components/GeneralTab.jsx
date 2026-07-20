import React, { useState, useEffect } from 'react';
import { Save, Loader2, Building2, MapPin, Briefcase, User, RefreshCw, X, CheckCircle2, ShieldCheck, Database, Users, Truck } from 'lucide-react';

const InputField = ({ label, name, type = 'text', required, placeholder, options, value, onChange }) => (
  <div className="flex flex-col">
    <label className="text-[14px] font-medium !text-black mb-[8px]">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {type === 'select' ? (
      <select
        name={name}
        value={value || ''}
        onChange={onChange}
        className="h-[48px] w-full px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[15px] font-medium !text-black focus:outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-[#2563EB]/10 hover:shadow-sm hover:border-[#D1D5DB] transition-all"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    ) : type === 'textarea' ? (
      <textarea
        name={name}
        value={value || ''}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        rows="2"
        className="w-full px-4 py-3 bg-white border border-[#E5E7EB] rounded-[10px] text-[15px] font-medium !text-black focus:outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-[#2563EB]/10 hover:shadow-sm hover:border-[#D1D5DB] transition-all resize-none"
      />
    ) : (
      <input
        type={type}
        name={name}
        value={value || ''}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className="h-[48px] w-full px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[15px] font-medium !text-black focus:outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-[#2563EB]/10 hover:shadow-sm hover:border-[#D1D5DB] transition-all"
      />
    )}
  </div>
);

const SectionHeader = ({ icon: Icon, title, description, tint = 'bg-[#FFF5EB]', iconColor = 'text-[#FF6A00]' }) => (
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

const StatRow = ({ label, value, badgeColor }) => (
  <div className="flex justify-between items-center py-2.5 border-b border-[#E5E7EB] last:border-0 last:pb-0">
    <span className="text-[14px] font-medium !text-[#163B63]">{label}</span>
    {badgeColor ? (
      <span className={`px-2.5 py-1 text-[12px] font-semibold rounded-full border ${badgeColor === 'green' ? 'bg-[#ECFDF5] text-[#16A34A] border-green-200' :
          badgeColor === 'blue' ? 'bg-[#EFF6FF] text-[#2563EB] border-blue-200' :
            'bg-gray-100 text-[#163B63] border-gray-200'
        }`}>
        {value}
      </span>
    ) : (
      <span className="text-[15px] font-semibold !text-[#163B63]">{value}</span>
    )}
  </div>
);

const GeneralTab = ({ profile, onSave }) => {
  const initialData = {
    contact_person: profile?.contact_person || '',
    email: profile?.email || '',
    mobile: profile?.mobile || '',
    alternate_mobile: profile?.alternate_mobile || '',
    address: profile?.address || '',
    city: profile?.city || '',
    state: profile?.state || '',
    country: profile?.country || '',
    pincode: profile?.pincode || '',
    gst_number: profile?.gst_number || '',
    website: profile?.website || '',
    timezone: profile?.timezone || 'UTC'
  };

  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const dirty = JSON.stringify(formData) !== JSON.stringify(initialData);
    setIsDirty(dirty);
  }, [formData, profile]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleReset = () => {
    setFormData(initialData);
    setError('');
    setSuccess('');
    setIsDirty(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!formData.email || !formData.mobile) {
      setError('Email and Mobile are required');
      setLoading(false);
      return;
    }

    const res = await onSave(formData);
    if (res.success) {
      setSuccess('Profile updated successfully!');
      setIsDirty(false);
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(res.error || 'Failed to update profile');
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-[20px] items-start w-full relative pb-[100px]">

      {/* Main Content Area (~68% of the remaining 78% page space) */}
      <div className="w-full lg:w-[68%]">

        {/* Alerts */}
        {error && <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-[14px] text-[14px] mb-[20px] shadow-sm">{error}</div>}
        {success && <div className="p-4 bg-[#ECFDF5] border border-green-200 text-[#16A34A] rounded-[14px] text-[14px] mb-[20px] shadow-sm">{success}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-[20px]">

          {/* Dense Organization Information */}
          <div className="bg-[#FFFFFF] p-[24px] pt-0 rounded-[14px] border border-[#E5E7EB] shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow">
            <SectionHeader icon={Building2} title="Organization Information" description="Primary identification and communication details." />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px] mt-[24px]">
              <InputField label="Contact Person" name="contact_person" placeholder="John Doe" value={formData.contact_person} onChange={handleChange} />
              <InputField label="Email Address" name="email" type="email" required placeholder="john@example.com" value={formData.email} onChange={handleChange} />
              <InputField label="Primary Mobile" name="mobile" type="tel" required placeholder="+1 234 567 8900" value={formData.mobile} onChange={handleChange} />
              <InputField label="Alternate Mobile" name="alternate_mobile" type="tel" placeholder="Optional" value={formData.alternate_mobile} onChange={handleChange} />
              <InputField label="Website URL" name="website" type="url" placeholder="https://example.com" value={formData.website} onChange={handleChange} />
              <InputField label="Tax ID / GST Number" name="gst_number" placeholder="Tax ID" value={formData.gst_number} onChange={handleChange} />
              <InputField
                label="Time Zone"
                name="timezone"
                type="select"
                value={formData.timezone}
                onChange={handleChange}
                options={[
                  { value: 'UTC', label: 'UTC' },
                  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
                  { value: 'America/New_York', label: 'America/New_York (EST)' }
                ]}
              />
            </div>
          </div>

          {/* Address Details */}
          <div className="bg-[#FFFFFF] p-[24px] pt-0 rounded-[14px] border border-[#E5E7EB] shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow">
            <SectionHeader icon={MapPin} title="Address Details" description="Registered physical address of the organization." />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px] mt-[24px]">
              <div className="md:col-span-2">
                <InputField label="Street Address" name="address" type="textarea" placeholder="123 Business Avenue, Suite 100" value={formData.address} onChange={handleChange} />
              </div>
              <InputField label="City" name="city" placeholder="City name" value={formData.city} onChange={handleChange} />
              <InputField label="State / Province" name="state" placeholder="State name" value={formData.state} onChange={handleChange} />
              <InputField label="Country" name="country" placeholder="Country" value={formData.country} onChange={handleChange} />
              <InputField label="Pincode / ZIP" name="pincode" placeholder="Postal code" value={formData.pincode} onChange={handleChange} />
            </div>
          </div>

          {/* Natural Actions (Bottom Right) */}
          <div className="flex justify-end gap-3 mt-2">

            <button
              type="submit"
              disabled={loading}
              className="px-6 h-[48px] flex items-center justify-center text-[15px] font-semibold text-white bg-gradient-to-r from-[#FF6A00] to-[#FF8A33] rounded-[10px] shadow-[0_4px_12px_rgba(255,106,0,0.3)] hover:shadow-[0_6px_16px_rgba(255,106,0,0.4)] transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {loading ? <Loader2 className="w-[20px] h-[20px] mr-2 animate-spin" /> : <Save className="w-[20px] h-[20px] mr-2" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>

      {/* Right Information Panel (~32% of the remaining 78% page space) */}
      <div className="w-full lg:w-[32%] flex flex-col gap-[20px]">

        {/* Profile Completion Widget */}
        <div className="bg-[#FFFFFF] p-[24px] rounded-[14px] border border-[#E5E7EB] shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow">
          <div className="flex items-center justify-between mb-3 border-b border-[#FFF5EB] pb-2 -mx-[24px] px-[24px] -mt-[24px] pt-[20px] bg-[#FFF5EB] rounded-t-[14px]">
            <h3 className="text-[16px] font-semibold !text-[#163B63] m-0">Profile Completion</h3>
            <span className="text-[15px] font-bold text-[#FF6A00]">85%</span>
          </div>
          <div className="w-full bg-[#E5E7EB] h-[8px] rounded-full overflow-hidden mb-4 mt-[16px]">
            <div className="bg-gradient-to-r from-[#FF6A00] to-[#F59E0B] h-full rounded-full transition-all duration-1000 ease-out" style={{ width: '85%' }}></div>
          </div>
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-[13px] font-medium !text-[#163B63]"><CheckCircle2 className="w-4 h-4 text-[#16A34A]" /> Add Website</div>
            <div className="flex items-center gap-2 text-[13px] font-medium !text-[#163B63]"><CheckCircle2 className="w-4 h-4 text-[#163B63]" /> Verify GST</div>
            <div className="flex items-center gap-2 text-[13px] font-medium !text-[#163B63]"><CheckCircle2 className="w-4 h-4 text-[#163B63]" /> Upload Logo</div>
          </div>
        </div>

        {/* Organization Status Widget */}
        <div className="bg-[#FFFFFF] p-[24px] rounded-[14px] border border-[#E5E7EB] shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#ECFDF5] -mx-[24px] px-[24px] -mt-[24px] pt-[20px] bg-[#ECFDF5] rounded-t-[14px]">
            <div className="p-1.5 bg-white rounded-lg shadow-sm">
              <ShieldCheck className="w-[18px] h-[18px] text-[#16A34A]" />
            </div>
            <h3 className="text-[16px] font-semibold !text-[#163B63] m-0">Organization Status</h3>
          </div>

          <div className="space-y-1">
            <StatRow label="Subscription Plan" value="Enterprise" badgeColor="blue" />
            <StatRow label="Created Date" value="Jan 12, 2026" />
            <StatRow label="Total Users" value="12 Active" />
            <StatRow label="Total Vehicles" value="48 / 50" />
            <StatRow label="License Status" value="Valid" badgeColor="green" />
            <StatRow label="Storage Usage" value="4.2 GB" />
            <StatRow label="Support Tier" value="Premium 24/7" badgeColor="blue" />
          </div>
        </div>
      </div>

      {/* Dynamic Sticky Save Bar */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-50 flex justify-center animate-in slide-in-from-bottom-full duration-300">
          <div className="max-w-[1200px] w-full flex flex-col sm:flex-row sm:items-center justify-between px-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#FFF5EB] rounded-full">
                <RefreshCw className="w-5 h-5 text-[#FF6A00]" />
              </div>
              <div>
                <h4 className="text-[15px] font-semibold !text-black m-0">You have unsaved changes</h4>
                <p className="text-[14px] !text-black m-0">Please save or reset your changes.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 h-[48px] flex items-center text-[15px] font-semibold text-white bg-gradient-to-r from-[#FF6A00] to-[#FF8A33] rounded-[10px] shadow-[0_4px_12px_rgba(255,106,0,0.3)] hover:shadow-[0_6px_16px_rgba(255,106,0,0.4)] transform hover:-translate-y-0.5 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-[20px] h-[20px] mr-2 animate-spin" /> : <Save className="w-[20px] h-[20px] mr-2" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralTab;