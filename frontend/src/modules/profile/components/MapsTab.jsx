import React, { useState, useEffect } from 'react';
import {
  Save, Loader2, Map as MapIcon, RefreshCw, Layers,
  Compass, Globe, KeyRound, CheckCircle2, ArrowLeft, ArrowRight, Eye, EyeOff
} from 'lucide-react';

const InputField = ({ label, name, type = 'text', required, placeholder, options, description, icon: Icon, value, onChange, showToggle, onToggleShow }) => (
  <div className="flex flex-col relative">
    <label className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2 flex items-center justify-between">
      <span>{label} {required && <span className="text-red-500">*</span>}</span>
    </label>
    <div className="relative">
      {Icon && (
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <Icon className="w-4 h-4 text-slate-500" />
        </div>
      )}
      {type === 'select' ? (
        <select
          name={name}
          value={value || ''}
          onChange={onChange}
          className={`h-12 w-full ${Icon ? 'pl-10' : 'pl-4'} pr-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-500/15 transition-all cursor-pointer`}
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
          className={`h-12 w-full ${Icon ? 'pl-10' : 'pl-4'} ${showToggle ? 'pr-11' : 'pr-4'} bg-slate-50 border-2 border-slate-300 rounded-2xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-500/15 transition-all`}
        />
      )}
      {showToggle && (
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 p-1"
        >
          {type === 'password' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      )}
    </div>
    {description && <p className="text-[11px] text-slate-500 font-semibold mt-1.5">{description}</p>}
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

const MapsTab = ({ profile, onSave, onNextTab, onPrevTab }) => {
  const primaryColor = profile?.primary_color || '#0284C7';

  const initialData = {
    map_provider: profile?.map_provider || 'OpenStreetMap',
    api_key: profile?.api_key || '',
    default_latitude: profile?.default_latitude || '',
    default_longitude: profile?.default_longitude || '',
    default_zoom: profile?.default_zoom || 12
  };

  const [formData, setFormData] = useState(initialData);
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setFormData({
      map_provider: profile?.map_provider || 'OpenStreetMap',
      api_key: profile?.api_key || '',
      default_latitude: profile?.default_latitude || '',
      default_longitude: profile?.default_longitude || '',
      default_zoom: profile?.default_zoom || 12
    });
  }, [profile]);

  useEffect(() => {
    const dirty = JSON.stringify(formData) !== JSON.stringify(initialData);
    setIsDirty(dirty);
  }, [formData]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e, shouldGoNext = false) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const res = await onSave({
      ...formData,
      default_latitude: formData.default_latitude ? parseFloat(formData.default_latitude) : null,
      default_longitude: formData.default_longitude ? parseFloat(formData.default_longitude) : null,
      default_zoom: parseInt(formData.default_zoom, 10) || 12
    });

    if (res.success) {
      setSuccess('Map & telematics settings updated successfully!');
      setIsDirty(false);
      if (shouldGoNext && onNextTab) {
        setTimeout(() => onNextTab(), 500);
      } else {
        setTimeout(() => setSuccess(''), 3500);
      }
    } else {
      setError(res.error || 'Failed to update map settings');
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col xl:flex-row gap-8 items-start w-full relative pb-28">
      {/* Main Settings Form */}
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
          {/* Map Engine Configuration */}
          <div className="bg-white p-7 rounded-3xl border border-slate-200/90 shadow-sm">
            <SectionHeader
              icon={Globe}
              title="Map Engine & Authentication Keys"
              description="Select the primary tile server and provide credentials for proprietary map layers"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <InputField
                label="Default Map Engine"
                name="map_provider"
                type="select"
                icon={Globe}
                value={formData.map_provider}
                onChange={handleChange}
                options={[
                  { value: 'OpenStreetMap', label: 'OpenStreetMap (Free / Open Source)' },
                  { value: 'Google Maps', label: 'Google Maps (Satellite & Traffic)' },
                  { value: 'Mapbox', label: 'Mapbox (Vector Street & Dark Layers)' }
                ]}
              />

              <InputField
                label="Provider API Key"
                name="api_key"
                type={showApiKey ? 'text' : 'password'}
                icon={KeyRound}
                placeholder={profile?.api_key ? '••••••••••••••••' : 'Enter Map API Key'}
                description="Encrypted and stored securely in backend vault."
                value={formData.api_key}
                onChange={handleChange}
                showToggle
                onToggleShow={() => setShowApiKey(!showApiKey)}
              />
            </div>
          </div>

          {/* Coordinates and Initial Viewport */}
          <div className="bg-white p-7 rounded-3xl border border-slate-200/90 shadow-sm">
            <SectionHeader
              icon={Compass}
              title="Default Fleet Coordinates & Zoom"
              description="Initial center point and camera altitude when opening Live Tracking & Fleet Map"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <InputField
                label="Default Latitude"
                name="default_latitude"
                type="number"
                placeholder="e.g. 17.3850"
                value={formData.default_latitude}
                onChange={handleChange}
              />

              <InputField
                label="Default Longitude"
                name="default_longitude"
                type="number"
                placeholder="e.g. 78.4867"
                value={formData.default_longitude}
                onChange={handleChange}
              />

              <InputField
                label="Initial Zoom Level (1 - 20)"
                name="default_zoom"
                type="number"
                placeholder="12"
                value={formData.default_zoom}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Navigation Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3.5 mt-2">
            {onPrevTab ? (
              <button
                type="button"
                onClick={onPrevTab}
                className="px-6 h-12 flex items-center justify-center text-xs font-extrabold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-2xl transition-all shadow-2xs"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Business Profile
              </button>
            ) : <div />}

            <div className="flex items-center gap-3">
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
                Save &amp; View License Quotas →
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Right Overview Panel */}
      <div className="w-full xl:w-[35%] flex flex-col gap-6 sticky top-8">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-lg">
          <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-100">
            <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 m-0">Map Engine Summary</h4>
              <span className="text-[11px] text-slate-500 font-semibold">Active Cartography Layer</span>
            </div>
          </div>

          <div className="space-y-3.5 text-xs font-medium">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Active Engine</div>
              <div className="text-sm font-black text-slate-900 mt-0.5">{formData.map_provider}</div>
              <div className="text-[11px] text-slate-500 mt-1">
                {formData.map_provider === 'OpenStreetMap'
                  ? 'High-speed open global tiles with zero per-request licensing costs.'
                  : formData.map_provider === 'Google Maps'
                  ? 'Includes Google Satellite imagery, 3D buildings, and live traffic overlays.'
                  : 'Vector tiles with hardware acceleration and custom fleet styling.'}
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Initial Camera</div>
                <div className="text-xs font-black text-slate-800 mt-0.5">
                  {formData.default_latitude && formData.default_longitude
                    ? `${formData.default_latitude}, ${formData.default_longitude}`
                    : 'Auto-fit active fleet'}
                </div>
              </div>
              <span className="text-xs font-black text-slate-700 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
                Zoom {formData.default_zoom || 12}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Save Toolbar when Dirty */}
      {isDirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 p-3.5 px-6 rounded-2xl shadow-2xl z-50 flex items-center gap-6 animate-in slide-in-from-bottom-6 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full animate-ping" style={{ backgroundColor: primaryColor }} />
            <span className="text-xs font-extrabold text-white">Unsaved map changes</span>
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

export default MapsTab;