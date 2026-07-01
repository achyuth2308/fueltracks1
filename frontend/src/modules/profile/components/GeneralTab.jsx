import React, { useState } from 'react';
import { Save, Loader2 } from 'lucide-react';

const GeneralTab = ({ profile, onSave }) => {
  const [formData, setFormData] = useState({
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
    
    // Basic validation
    if (!formData.email || !formData.mobile) {
      setError('Email and Mobile are required');
      setLoading(false);
      return;
    }
    
    const res = await onSave(formData);
    if (res.success) {
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(res.error || 'Failed to update profile');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-10 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200">
      <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#000000", margin: 0, letterSpacing: "-0.01em", marginBottom: "24px" }}>Organization Details</h2>
      
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md text-sm">{success}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-[13px] font-bold uppercase tracking-wide mb-1" style={{ color: "#000000" }}>Contact Person</label>
          <input type="text" name="contact_person" value={formData.contact_person} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm  focus:outline-none focus:border-[#f97316] focus:ring-4 focus:ring-[#f97316]/10 transition-all" style={{ color: "#000000" }} />
        </div>
        <div>
          <label className="block text-[13px] font-bold uppercase tracking-wide mb-1" style={{ color: "#000000" }}>Email <span className="text-red-500">*</span></label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm  focus:outline-none focus:border-[#f97316] focus:ring-4 focus:ring-[#f97316]/10 transition-all" style={{ color: "#000000" }} />
        </div>
        <div>
          <label className="block text-[13px] font-bold uppercase tracking-wide mb-1" style={{ color: "#000000" }}>Mobile <span className="text-red-500">*</span></label>
          <input type="tel" name="mobile" value={formData.mobile} onChange={handleChange} required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm  focus:outline-none focus:border-[#f97316] focus:ring-4 focus:ring-[#f97316]/10 transition-all" style={{ color: "#000000" }} />
        </div>
        <div>
          <label className="block text-[13px] font-bold uppercase tracking-wide mb-1" style={{ color: "#000000" }}>Alternate Mobile</label>
          <input type="tel" name="alternate_mobile" value={formData.alternate_mobile} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm  focus:outline-none focus:border-[#f97316] focus:ring-4 focus:ring-[#f97316]/10 transition-all" style={{ color: "#000000" }} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-[13px] font-bold uppercase tracking-wide mb-1" style={{ color: "#000000" }}>Address</label>
          <textarea name="address" value={formData.address} onChange={handleChange} rows="3" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm  focus:outline-none focus:border-[#f97316] focus:ring-4 focus:ring-[#f97316]/10 transition-all" style={{ color: "#000000" }}></textarea>
        </div>
        <div>
          <label className="block text-[13px] font-bold uppercase tracking-wide mb-1" style={{ color: "#000000" }}>City</label>
          <input type="text" name="city" value={formData.city} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm  focus:outline-none focus:border-[#f97316] focus:ring-4 focus:ring-[#f97316]/10 transition-all" style={{ color: "#000000" }} />
        </div>
        <div>
          <label className="block text-[13px] font-bold uppercase tracking-wide mb-1" style={{ color: "#000000" }}>State</label>
          <input type="text" name="state" value={formData.state} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm  focus:outline-none focus:border-[#f97316] focus:ring-4 focus:ring-[#f97316]/10 transition-all" style={{ color: "#000000" }} />
        </div>
        <div>
          <label className="block text-[13px] font-bold uppercase tracking-wide mb-1" style={{ color: "#000000" }}>Country</label>
          <input type="text" name="country" value={formData.country} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm  focus:outline-none focus:border-[#f97316] focus:ring-4 focus:ring-[#f97316]/10 transition-all" style={{ color: "#000000" }} />
        </div>
        <div>
          <label className="block text-[13px] font-bold uppercase tracking-wide mb-1" style={{ color: "#000000" }}>Pincode</label>
          <input type="text" name="pincode" value={formData.pincode} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm  focus:outline-none focus:border-[#f97316] focus:ring-4 focus:ring-[#f97316]/10 transition-all" style={{ color: "#000000" }} />
        </div>
        <div>
          <label className="block text-[13px] font-bold uppercase tracking-wide mb-1" style={{ color: "#000000" }}>GST Number (Optional)</label>
          <input type="text" name="gst_number" value={formData.gst_number} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm  focus:outline-none focus:border-[#f97316] focus:ring-4 focus:ring-[#f97316]/10 transition-all" style={{ color: "#000000" }} />
        </div>
        <div>
          <label className="block text-[13px] font-bold uppercase tracking-wide mb-1" style={{ color: "#000000" }}>Website URL</label>
          <input type="url" name="website" value={formData.website} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm  focus:outline-none focus:border-[#f97316] focus:ring-4 focus:ring-[#f97316]/10 transition-all" style={{ color: "#000000" }} />
        </div>
        <div>
          <label className="block text-[13px] font-bold uppercase tracking-wide mb-1" style={{ color: "#000000" }}>Timezone</label>
          <select name="timezone" value={formData.timezone} onChange={handleChange} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm  focus:outline-none focus:border-[#f97316] focus:ring-4 focus:ring-[#f97316]/10 transition-all" style={{ color: "#000000" }}>
            <option className="!bg-white hover:!bg-[#f97316]" style={{ color: "#000000" }} value="UTC">UTC</option>
            <option className="!bg-white hover:!bg-[#f97316]" style={{ color: "#000000" }} value="Asia/Kolkata">Asia/Kolkata (IST)</option>
            <option className="!bg-white hover:!bg-[#f97316]" style={{ color: "#000000" }} value="America/New_York">America/New_York (EST)</option>
            <option className="!bg-white hover:!bg-[#f97316]" style={{ color: "#000000" }} value="Europe/London">Europe/London (GMT)</option>
          </select>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center px-4 py-2 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 shadow-[0_4px_12px_rgba(249,115,22,0.3)] transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#f97316] disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </button>
      </div>
    </form>
  );
};

export default GeneralTab;
