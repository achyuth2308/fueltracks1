import React, { useState } from 'react';
import { Save, Loader2, Map as MapIcon } from 'lucide-react';

const MapsTab = ({ profile, onSave }) => {
  const [formData, setFormData] = useState({
    map_provider: profile?.map_provider || 'OpenStreetMap',
    api_key: profile?.api_key || '',
    default_latitude: profile?.default_latitude || '',
    default_longitude: profile?.default_longitude || '',
    default_zoom: profile?.default_zoom || 12
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
    
    const res = await onSave({
      ...formData,
      default_latitude: formData.default_latitude ? parseFloat(formData.default_latitude) : null,
      default_longitude: formData.default_longitude ? parseFloat(formData.default_longitude) : null,
      default_zoom: parseInt(formData.default_zoom)
    });

    if (res.success) {
      setSuccess('Map settings updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(res.error || 'Failed to update map settings');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-10 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200">
      <div className="flex items-center mb-6">
        <MapIcon className="w-6 h-6 text-orange-500 mr-3" />
        <h3 className="text-xl font-extrabold text-[#0a2540] tracking-tight">Map Configuration</h3>
      </div>
      
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md text-sm">{success}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        <div>
          <label className="block text-[13px] font-bold text-[#1a365d] uppercase tracking-wide mb-1">Default Map Provider</label>
          <select name="map_provider" value={formData.map_provider} onChange={handleChange} className="w-full px-4 py-3 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm text-[#0a2540] focus:outline-none focus:border-[#f97316] focus:ring-4 focus:ring-[#f97316]/10 transition-all">
            <option className="text-[#112d4e] !bg-white hover:!bg-[#f97316]" value="OpenStreetMap">OpenStreetMap</option>
            <option className="text-[#112d4e] !bg-white hover:!bg-[#f97316]" value="Google Maps">Google Maps</option>
            <option className="text-[#112d4e] !bg-white hover:!bg-[#f97316]" value="Mapbox">Mapbox</option>
          </select>
        </div>

        <div>
          <label className="block text-[13px] font-bold text-[#1a365d] uppercase tracking-wide mb-1">API Key</label>
          <input 
            type="password" 
            name="api_key" 
            value={formData.api_key} 
            onChange={handleChange} 
            placeholder={profile?.api_key ? "••••••••••••••••" : "Enter API Key"}
            className="w-full px-4 py-3 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm text-[#0a2540] focus:outline-none focus:border-[#f97316] focus:ring-4 focus:ring-[#f97316]/10 transition-all" 
          />
          <p className="text-xs text-[#112d4e] mt-1">Leave blank to keep existing key. Key is stored encrypted.</p>
        </div>

        <div className="md:col-span-2 border-t pt-6 mt-2">
          <h4 className="text-sm font-medium text-[#112d4e] mb-4">Default Map View</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-[#1a365d] uppercase tracking-wide mb-1">Center Latitude</label>
              <input type="number" step="any" name="default_latitude" value={formData.default_latitude} onChange={handleChange} placeholder="e.g., 28.6139" className="w-full px-4 py-3 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm text-[#0a2540] focus:outline-none focus:border-[#f97316] focus:ring-4 focus:ring-[#f97316]/10 transition-all text-sm" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#1a365d] uppercase tracking-wide mb-1">Center Longitude</label>
              <input type="number" step="any" name="default_longitude" value={formData.default_longitude} onChange={handleChange} placeholder="e.g., 77.2090" className="w-full px-4 py-3 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm text-[#0a2540] focus:outline-none focus:border-[#f97316] focus:ring-4 focus:ring-[#f97316]/10 transition-all text-sm" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#1a365d] uppercase tracking-wide mb-1">Default Zoom Level</label>
              <input type="number" min="1" max="20" name="default_zoom" value={formData.default_zoom} onChange={handleChange} className="w-full px-4 py-3 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm text-[#0a2540] focus:outline-none focus:border-[#f97316] focus:ring-4 focus:ring-[#f97316]/10 transition-all text-sm" />
            </div>
          </div>
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

export default MapsTab;
