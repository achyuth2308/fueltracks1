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
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex items-center mb-6">
        <MapIcon className="w-5 h-5 !text-black mr-2" />
        <h3 className="text-lg font-semibold !text-black">Map Configuration</h3>
      </div>
      
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md text-sm">{success}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        <div>
          <label className="block text-sm font-medium !text-black mb-1">Default Map Provider</label>
          <select name="map_provider" value={formData.map_provider} onChange={handleChange} className="w-full border-black !text-black placeholder-black rounded-md shadow-sm focus:ring-[#8ba0b5] focus:border-[#8ba0b5]">
            <option className="!text-black !bg-white hover:!bg-[#8ba0b5]" value="OpenStreetMap">OpenStreetMap</option>
            <option className="!text-black !bg-white hover:!bg-[#8ba0b5]" value="Google Maps">Google Maps</option>
            <option className="!text-black !bg-white hover:!bg-[#8ba0b5]" value="Mapbox">Mapbox</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium !text-black mb-1">API Key</label>
          <input 
            type="password" 
            name="api_key" 
            value={formData.api_key} 
            onChange={handleChange} 
            placeholder={profile?.api_key ? "••••••••••••••••" : "Enter API Key"}
            className="w-full border-black !text-black placeholder-black rounded-md shadow-sm focus:ring-[#8ba0b5] focus:border-[#8ba0b5]" 
          />
          <p className="text-xs !text-black mt-1">Leave blank to keep existing key. Key is stored encrypted.</p>
        </div>

        <div className="md:col-span-2 border-t pt-6 mt-2">
          <h4 className="text-sm font-medium !text-black mb-4">Default Map View</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium !text-black mb-1">Center Latitude</label>
              <input type="number" step="any" name="default_latitude" value={formData.default_latitude} onChange={handleChange} placeholder="e.g., 28.6139" className="w-full border-black !text-black placeholder-black rounded-md shadow-sm focus:ring-[#8ba0b5] focus:border-[#8ba0b5] text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium !text-black mb-1">Center Longitude</label>
              <input type="number" step="any" name="default_longitude" value={formData.default_longitude} onChange={handleChange} placeholder="e.g., 77.2090" className="w-full border-black !text-black placeholder-black rounded-md shadow-sm focus:ring-[#8ba0b5] focus:border-[#8ba0b5] text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium !text-black mb-1">Default Zoom Level</label>
              <input type="number" min="1" max="20" name="default_zoom" value={formData.default_zoom} onChange={handleChange} className="w-full border-black !text-black placeholder-black rounded-md shadow-sm focus:ring-[#8ba0b5] focus:border-[#8ba0b5] text-sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center px-4 py-2 bg-[#8ba0b5] text-white rounded-md hover:bg-[#7ea0b6] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8ba0b5] disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </button>
      </div>
    </form>
  );
};

export default MapsTab;
