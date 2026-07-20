import React, { useState, useEffect } from 'react';
import { Save, Loader2, Map as MapIcon, RefreshCw, Layers, Compass, Globe, KeyRound } from 'lucide-react';

const InputField = ({ label, name, type = 'text', required, placeholder, options, description, icon: Icon, iconColorClass = "text-[#6B7280]", value, onChange }) => (
  <div className="flex flex-col relative">
    <label className="text-[14px] font-medium !text-black mb-[8px]">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative">
      {Icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <Icon className={`w-5 h-5 ${iconColorClass}`} />
        </div>
      )}
      {type === 'select' ? (
        <select
          name={name}
          value={value || ''}
          onChange={onChange}
          className={`h-[48px] w-full ${Icon ? 'pl-10' : 'pl-4'} pr-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[15px] font-medium !text-black focus:outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-blue-500/20 hover:border-[#D1D5DB] transition-all`}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          name={name}
          value={value || ''}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          step={type === 'number' ? 'any' : undefined}
          min={name === 'default_zoom' ? '1' : undefined}
          max={name === 'default_zoom' ? '20' : undefined}
          className={`h-[48px] w-full ${Icon ? 'pl-10' : 'pl-4'} pr-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[15px] font-medium !text-black focus:outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-blue-500/20 hover:border-[#D1D5DB] transition-all`}
        />
      )}
    </div>
    {description && <p className="text-[12px] !text-black mt-1.5">{description}</p>}
  </div>
);

const SectionHeader = ({ icon: Icon, title, description, tint = 'bg-[#ECFDF5]', iconColor = 'text-[#16A34A]' }) => (
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

const MapsTab = ({ profile, onSave }) => {
  const initialData = {
    map_provider: profile?.map_provider || 'OpenStreetMap',
    api_key: profile?.api_key || '',
    default_latitude: profile?.default_latitude || '',
    default_longitude: profile?.default_longitude || '',
    default_zoom: profile?.default_zoom || 12
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
    if (e) e.preventDefault();
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
      setIsDirty(false);
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(res.error || 'Failed to update map settings');
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-[20px] items-start w-full relative pb-[100px]">

      {/* Main Content Area (~68% of the remaining 80% page space) */}
      <div className="w-full lg:w-[68%]">

        {/* Alerts */}
        {error && <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-[14px] text-[14px] mb-[20px] shadow-sm">{error}</div>}
        {success && <div className="p-4 bg-[#ECFDF5] border border-green-200 text-[#16A34A] rounded-[14px] text-[14px] mb-[20px] shadow-sm">{success}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-[20px]">

          <div className="bg-[#FFFFFF] p-[24px] pt-0 rounded-[14px] border border-[#E5E7EB] shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow">
            <SectionHeader icon={MapIcon} title="Map Provider Settings" description="Configure the primary mapping engine and API authentication." />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px] mt-[24px]">
              <InputField
                label="Default Map Provider"
                name="map_provider"
                type="select"
                icon={Globe}
                iconColorClass="text-[#16A34A]"
                value={formData.map_provider}
                onChange={handleChange}
                options={[
                  { value: 'OpenStreetMap', label: 'OpenStreetMap (Free)' },
                  { value: 'Google Maps', label: 'Google Maps (Requires API Key)' },
                  { value: 'Mapbox', label: 'Mapbox (Requires API Key)' }
                ]}
              />
              <InputField
                label="API Key"
                name="api_key"
                type="password"
                icon={KeyRound}
                iconColorClass="text-[#2563EB]"
                placeholder={profile?.api_key ? "••••••••••••••••" : "Enter API Key"}
                description="Leave blank to keep existing key. Key is stored encrypted."
                value={formData.api_key}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="bg-[#FFFFFF] p-[24px] pt-0 rounded-[14px] border border-[#E5E7EB] shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow">
            <SectionHeader icon={Compass} title="Default Map View" description="Set the initial coordinates and zoom level for the tracking dashboard." />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-[20px] mt-[24px]">
              <InputField
                label="Center Latitude"
                name="default_latitude"
                type="number"
                placeholder="e.g., 28.6139"
                value={formData.default_latitude}
                onChange={handleChange}
              />
              <InputField
                label="Center Longitude"
                name="default_longitude"
                type="number"
                placeholder="e.g., 77.2090"
                value={formData.default_longitude}
                onChange={handleChange}
              />
              <InputField
                label="Default Zoom Level"
                name="default_zoom"
                type="number"
                description="1 (World) to 20 (Building)"
                icon={Compass}
                iconColorClass="text-[#FF6A00]"
                value={formData.default_zoom}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Natural Actions */}
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

      {/* Right Information Panel (~32% of the remaining 80% page space) */}
      <div className="w-full lg:w-[32%] flex-shrink-0">
        <div className="bg-[#FFFFFF] p-[24px] rounded-[14px] border border-[#E5E7EB] shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow sticky top-[24px]">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#ECFDF5] -mx-[24px] px-[24px] -mt-[24px] pt-[20px] bg-[#ECFDF5] rounded-t-[14px]">
            <div className="p-1.5 bg-white rounded-lg shadow-sm">
              <Layers className="w-[18px] h-[18px] text-[#16A34A]" />
            </div>
            <h3 className="text-[16px] font-semibold !text-black m-0">Map Integration</h3>
          </div>

          <div className="space-y-4 mt-[16px]">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-[#EFF6FF] rounded-lg mt-0.5 shadow-sm border border-blue-100">
                <Globe className="w-4 h-4 text-[#2563EB]" />
              </div>
              <div>
                <h4 className="text-[14px] font-semibold !text-black">API Usage</h4>
                <p className="text-[13px] !text-black leading-relaxed mt-1">
                  12,450 / 50,000 requests used this month.
                </p>
                <div className="w-full bg-[#E5E7EB] h-[6px] rounded-full overflow-hidden mt-2">
                  <div className="bg-[#2563EB] h-full rounded-full" style={{ width: '25%' }}></div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#FFF5EB] border border-orange-200 rounded-xl mt-4 shadow-sm">
              <h4 className="text-[14px] font-semibold text-orange-800 mb-1">Need a Google API Key?</h4>
              <p className="text-[13px] text-orange-700 leading-relaxed">
                To use Google Maps, you must enable the Maps JavaScript API and Geocoding API in your Google Cloud Console.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Sticky Save Bar */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-50 flex justify-center animate-in slide-in-from-bottom-full duration-300">
          <div className="max-w-[1200px] w-full flex flex-col sm:flex-row sm:items-center justify-between px-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#ECFDF5] rounded-full">
                <RefreshCw className="w-5 h-5 text-[#16A34A]" />
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

export default MapsTab;