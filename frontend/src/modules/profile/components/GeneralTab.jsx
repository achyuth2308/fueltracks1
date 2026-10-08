import React, { useState, useEffect } from 'react';
import {
  Save, Loader2, Building2, MapPin, User, RefreshCw,
  CheckCircle2, ShieldCheck, Globe, Mail, Phone, Clock, ArrowRight
} from 'lucide-react';

const InputField = ({ label, name, type = 'text', required, placeholder, options, value, onChange, helperText }) => (
  <div className="flex flex-col">
    <label className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2 flex items-center justify-between">
      <span>{label} {required && <span className="text-red-500">*</span>}</span>
      {helperText && <span className="text-[11px] font-bold text-slate-500 lowercase">{helperText}</span>}
    </label>
    {type === 'select' ? (
      <select
        name={name}
        value={value || ''}
        onChange={onChange}
        className="h-12 px-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-500/15 transition-all cursor-pointer"
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
        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-300 rounded-2xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-500/15 transition-all resize-none"
      />
    ) : (
      <input
        type={type}
        name={name}
        value={value || ''}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className="h-12 px-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-500/15 transition-all"
      />
    )}
  </div>
);

const SectionHeader = ({ icon: Icon, title, description }) => (
  <div className="flex items-center gap-3.5 pb-4 mb-6 border-b border-slate-100">
    <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-xs">
      <Icon className="w-5 h-5 stroke-[2.2]" />
    </div>
    <div>
      <h3 className="text-base font-black uppercase tracking-wide m-0" style={{ color: '#0F172A' }}>{title}</h3>
      <p className="text-xs text-slate-600 font-semibold m-0 mt-0.5">{description}</p>
    </div>
  </div>
);

const GeneralTab = ({ profile, onSave, onNextTab }) => {
  const primaryColor = profile?.primary_color || '#0284C7';

  const initialData = {
    contact_person: profile?.contact_person || '',
    email: profile?.email || '',
    mobile: profile?.mobile || '',
    alternate_mobile: profile?.alternate_mobile || '',
    address: profile?.address || '',
    city: profile?.city || '',
    state: profile?.state || '',
    country: profile?.country || 'India',
    pincode: profile?.pincode || '',
    gst_number: profile?.gst_number || '',
    website: profile?.website || '',
    timezone: profile?.timezone || 'Asia/Kolkata'
  };

  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setFormData({
      contact_person: profile?.contact_person || '',
      email: profile?.email || '',
      mobile: profile?.mobile || '',
      alternate_mobile: profile?.alternate_mobile || '',
      address: profile?.address || '',
      city: profile?.city || '',
      state: profile?.state || '',
      country: profile?.country || 'India',
      pincode: profile?.pincode || '',
      gst_number: profile?.gst_number || '',
      website: profile?.website || '',
      timezone: profile?.timezone || 'Asia/Kolkata'
    });
  }, [profile]);

  useEffect(() => {
    const dirty = JSON.stringify(formData) !== JSON.stringify(initialData);
    setIsDirty(dirty);
  }, [formData]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e, shouldGoNext = true) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!formData.email || !formData.mobile) {
      setError('Primary Email and Mobile Number are required');
      setLoading(false);
      return;
    }

    const res = await onSave(formData);
    if (res.success) {
      setSuccess('Organization profile updated successfully!');
      setIsDirty(false);
      if (shouldGoNext && onNextTab) {
        setTimeout(() => onNextTab(), 500);
      } else {
        setTimeout(() => setSuccess(''), 3500);
      }
    } else {
      setError(res.error || 'Failed to update organization profile');
    }
    setLoading(false);
  };

  // Compute profile completion
  const fields = ['contact_person', 'email', 'mobile', 'address', 'city', 'state', 'pincode', 'gst_number', 'website'];
  const filledFields = fields.filter(f => !!formData[f]);
  const completionPercent = Math.round((filledFields.length / fields.length) * 100);

  return (
    <div className="flex flex-col xl:flex-row gap-8 items-start w-full relative pb-28">
      {/* Main Form Content */}
      <div className="w-full xl:w-[65%] flex flex-col gap-6">
        {/* Alerts */}
        {error && (
          <div className="p-4 bg-red-50/90 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold shadow-sm flex items-center gap-3 animate-in fade-in">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-50/90 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold shadow-sm flex items-center gap-3 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Organization & Representative Information */}
          <div className="bg-white p-7 rounded-3xl border border-slate-200/90 shadow-sm">
            <SectionHeader
              icon={Building2}
              title="Organization & Representative Info"
              description="Primary contacts, official business identification, and time zone configuration"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <InputField
                label="Primary Contact Person"
                name="contact_person"
                required
                placeholder="e.g. Ramesh Kumar"
                value={formData.contact_person}
                onChange={handleChange}
              />
              <InputField
                label="Official Email Address"
                name="email"
                type="email"
                required
                placeholder="contact@company.com"
                value={formData.email}
                onChange={handleChange}
              />
              <InputField
                label="Primary Mobile Phone"
                name="mobile"
                type="tel"
                required
                placeholder="+91 98765 43210"
                value={formData.mobile}
                onChange={handleChange}
              />
              <InputField
                label="Alternate Phone / Office"
                name="alternate_mobile"
                type="tel"
                placeholder="Optional"
                value={formData.alternate_mobile}
                onChange={handleChange}
              />
              <InputField
                label="Tax ID / GST Number"
                name="gst_number"
                placeholder="22AAAAA0000A1Z5"
                value={formData.gst_number}
                onChange={handleChange}
              />
              <InputField
                label="Official Website URL"
                name="website"
                type="url"
                placeholder="https://company.com"
                value={formData.website}
                onChange={handleChange}
              />
              <div className="md:col-span-2">
                <InputField
                  label="Operational Time Zone"
                  name="timezone"
                  type="select"
                  value={formData.timezone}
                  onChange={handleChange}
                  options={[
                    { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST - UTC+05:30)' },
                    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
                    { value: 'America/New_York', label: 'America/New_York (EST)' },
                    { value: 'Europe/London', label: 'Europe/London (GMT)' },
                    { value: 'Asia/Dubai', label: 'Asia/Dubai (GST - UTC+04:00)' }
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Physical Address Details */}
          <div className="bg-white p-7 rounded-3xl border border-slate-200/90 shadow-sm">
            <SectionHeader
              icon={MapPin}
              title="Registered Headquarters & Billing Address"
              description="Official location for monthly billing invoices, dispatches, and compliance"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <InputField
                  label="Street Address / Suite / Building"
                  name="address"
                  type="textarea"
                  placeholder="Plot No. 12, Industrial Estate, Cyber Valley"
                  value={formData.address}
                  onChange={handleChange}
                />
              </div>
              <InputField
                label="City"
                name="city"
                placeholder="Hyderabad"
                value={formData.city}
                onChange={handleChange}
              />
              <InputField
                label="State / Province"
                name="state"
                placeholder="Telangana"
                value={formData.state}
                onChange={handleChange}
              />
              <InputField
                label="Country"
                name="country"
                placeholder="India"
                value={formData.country}
                onChange={handleChange}
              />
              <InputField
                label="PIN / Postal Code"
                name="pincode"
                placeholder="500081"
                value={formData.pincode}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-3.5 mt-2">
            <button
              type="button"
              disabled={loading}
              onClick={(e) => handleSubmit(e, false)}
              className="px-6 h-12 flex items-center justify-center text-xs font-extrabold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-2xl transition-all shadow-2xs disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Only
            </button>
            <button
              type="submit"
              disabled={loading}
              onClick={(e) => handleSubmit(e, true)}
              style={{ backgroundColor: primaryColor }}
              className="px-8 h-12 flex items-center justify-center text-xs font-extrabold text-white rounded-2xl shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save &amp; Configure Maps →
            </button>
          </div>
        </form>
      </div>

      {/* Right Side Overview Sidebar */}
      <div className="w-full xl:w-[35%] flex flex-col gap-6 sticky top-8">
        {/* Profile Strength Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-extrabold text-slate-900 m-0">Organization Profile Strength</h4>
            <span className="text-sm font-black" style={{ color: primaryColor }}>{completionPercent}%</span>
          </div>

          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-5">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${completionPercent}%`, backgroundColor: primaryColor }}
            />
          </div>

          <div className="space-y-3 text-xs text-slate-600 font-medium">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className={`w-4 h-4 ${formData.contact_person ? 'text-emerald-500' : 'text-slate-300'}`} />
              <span>Contact Person Name</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className={`w-4 h-4 ${formData.email ? 'text-emerald-500' : 'text-slate-300'}`} />
              <span>Official Email Address</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className={`w-4 h-4 ${formData.gst_number ? 'text-emerald-500' : 'text-slate-300'}`} />
              <span>GSTIN / Tax Compliance ID</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className={`w-4 h-4 ${formData.website ? 'text-emerald-500' : 'text-slate-300'}`} />
              <span>Corporate Website URL</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className={`w-4 h-4 ${formData.address ? 'text-emerald-500' : 'text-slate-300'}`} />
              <span>Registered Headquarters Address</span>
            </div>
          </div>
        </div>

        {/* Verification Status Card */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent p-6 rounded-3xl border border-emerald-200/80 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-2xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-emerald-950 m-0">Verified Organization</h4>
              <span className="text-[11px] text-emerald-700 font-semibold">Active Fleet Subscription</span>
            </div>
          </div>
          <p className="text-xs text-emerald-900/90 m-0 mt-3 leading-relaxed font-medium">
            All trip logs, fuel consumption metrics, driver reports, and telemetry sensor alerts are synchronized under this organization workspace.
          </p>
        </div>
      </div>

      {/* Floating Save Toolbar when Dirty */}
      {isDirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 p-3.5 px-6 rounded-2xl shadow-2xl z-50 flex items-center gap-6 animate-in slide-in-from-bottom-6 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full animate-ping" style={{ backgroundColor: primaryColor }} />
            <span className="text-xs font-extrabold text-white">Unsaved organization changes</span>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            style={{ backgroundColor: primaryColor }}
            className="px-5 h-9 flex items-center justify-center text-xs font-black text-white rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
};

export default GeneralTab;