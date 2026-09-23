import React, { useState, useEffect, useRef } from 'react';
import {
  Palette, Image as ImageIcon, Globe, Shield, Save, Loader2,
  Upload, CheckCircle2, Sparkles, RefreshCw, Eye, Smartphone, Mail,
  Layout, Monitor, ExternalLink, HelpCircle, ArrowRight, Lock,
  Layers, Check, Copy, Sliders, Sun, Moon, Info
} from 'lucide-react';
import { applyBrowserBranding } from '../../../utils/branding';

const PRESET_COLORS = [
  { name: 'FuelTracks Orange', primary: '#FF6A00', secondary: '#2E4867', desc: 'Signature high-contrast theme' },
  { name: 'Electric Indigo', primary: '#4F46E5', secondary: '#1E1B4B', desc: 'Modern tech & logistics' },
  { name: 'Emerald Fleet', primary: '#059669', secondary: '#064E3B', desc: 'Clean energy & sustainability' },
  { name: 'Oceanic Blue', primary: '#0284C7', secondary: '#0C4A6E', desc: 'Corporate telematics' },
  { name: 'Midnight Violet', primary: '#7C3AED', secondary: '#2E1065', desc: 'Luxury & executive fleets' },
  { name: 'Crimson Red', primary: '#DC2626', secondary: '#450A0A', desc: 'High-urgency emergency fleets' }
];

const WhiteLabelTab = ({ profile, onSave, onUploadImage, onNextTab }) => {
  const initialData = {
    is_whitelabel_enabled: profile?.is_whitelabel_enabled !== false,
    brand_name: profile?.brand_name || profile?.org_name || '',
    brand_tagline: profile?.brand_tagline || 'Advanced Fleet Telematics & Fuel Tracking',
    subdomain: profile?.subdomain || '',
    primary_color: profile?.primary_color || '#0284C7',
    secondary_color: profile?.secondary_color || '#0F172A',
    footer_text: profile?.footer_text || `© ${new Date().getFullYear()} ${profile?.brand_name || profile?.org_name || 'Telematics'}. All rights reserved.`,
    support_email: profile?.support_email || profile?.email || '',
    support_phone: profile?.support_phone || profile?.mobile || '',
    logo_url: profile?.logo_url || '',
    favicon_url: profile?.favicon_url || '',
    login_background_url: profile?.login_background_url || ''
  };

  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [uploadingField, setUploadingField] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // Preview mode toggle: 'dashboard' vs 'login'
  const [previewMode, setPreviewMode] = useState('dashboard');
  // Logo preview backdrop toggle: 'dark' vs 'light'
  const [logoBackdrop, setLogoBackdrop] = useState('dark');

  const logoInputRef = useRef(null);
  const faviconInputRef = useRef(null);
  const bgInputRef = useRef(null);

  useEffect(() => {
    setFormData({
      is_whitelabel_enabled: profile?.is_whitelabel_enabled !== false,
      brand_name: profile?.brand_name || profile?.org_name || '',
      brand_tagline: profile?.brand_tagline || 'Advanced Fleet Telematics & Fuel Tracking',
      subdomain: profile?.subdomain || '',
      primary_color: profile?.primary_color || '#0284C7',
      secondary_color: profile?.secondary_color || '#0F172A',
      footer_text: profile?.footer_text || `© ${new Date().getFullYear()} ${profile?.brand_name || profile?.org_name || 'Telematics'}. All rights reserved.`,
      support_email: profile?.support_email || profile?.email || '',
      support_phone: profile?.support_phone || profile?.mobile || '',
      logo_url: profile?.logo_url || '',
      favicon_url: profile?.favicon_url || '',
      login_background_url: profile?.login_background_url || ''
    });
  }, [profile]);

  useEffect(() => {
    const dirty = JSON.stringify(formData) !== JSON.stringify(initialData);
    setIsDirty(dirty);
  }, [formData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let finalValue = type === 'checkbox' ? checked : value;
    if (name === 'subdomain' && typeof value === 'string') {
      finalValue = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    }

    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: finalValue
      };
      if (name === 'primary_color' || name === 'secondary_color') {
        applyBrowserBranding(updated);
      }
      return updated;
    });
  };

  const handleColorPreset = (preset) => {
    setFormData(prev => {
      const updated = {
        ...prev,
        primary_color: preset.primary,
        secondary_color: preset.secondary
      };
      applyBrowserBranding(updated);
      return updated;
    });
  };

  const handleFileUpload = async (type, file) => {
    if (!file) return;
    setUploadingField(type);
    setError('');
    setSuccess('');

    const res = await onUploadImage(type, file);
    if (res.success) {
      const fieldMap = {
        logo: 'logo_url',
        favicon: 'favicon_url',
        background: 'login_background_url'
      };
      const updatedData = { ...formData, [fieldMap[type]]: res.fileUrl || formData[fieldMap[type]] };
      setFormData(updatedData);

      // Apply immediately to the live browser tab
      if (type === 'favicon' || type === 'logo') {
        applyBrowserBranding(updatedData);
      }

      setSuccess(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully!`);
      setTimeout(() => setSuccess(''), 3500);
    } else {
      setError(res.error || `Failed to upload ${type}`);
    }
    setUploadingField(null);
  };

  const handleSubmit = async (e, shouldGoNext = true) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const res = await onSave(formData);
    if (res.success) {
      applyBrowserBranding(formData);
      setSuccess('Dealership branding and white-label theme applied successfully!');
      setIsDirty(false);
      if (shouldGoNext && onNextTab) {
        setTimeout(() => {
          onNextTab();
        }, 500);
      } else {
        setTimeout(() => setSuccess(''), 3500);
      }
    } else {
      setError(res.error || 'Failed to save branding changes');
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col xl:flex-row gap-8 items-start w-full relative pb-28">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={logoInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileUpload('logo', e.target.files[0])}
      />
      <input
        type="file"
        ref={faviconInputRef}
        accept="image/*,.ico"
        className="hidden"
        onChange={(e) => handleFileUpload('favicon', e.target.files[0])}
      />
      <input
        type="file"
        ref={bgInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileUpload('background', e.target.files[0])}
      />

      {/* Left Settings Column */}
      <div className="w-full xl:w-[60%] flex flex-col gap-6">
        {/* Toast Alerts */}
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
          {/* Card 1: Master White-Label Activation Hub */}
          <div className="bg-white p-7 rounded-3xl border border-slate-200/90 shadow-sm relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl text-white flex items-center justify-center shadow-lg flex-shrink-0"
                  style={{ backgroundColor: formData.primary_color || '#0284C7' }}
                >
                  <Sparkles className="w-7 h-7 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-xl sm:text-2xl font-black m-0 tracking-tight" style={{ color: '#0F172A' }}>Dealership White-Label Suite</h3>
                    <span className={`px-3 py-0.5 text-xs font-black rounded-full shadow-xs ${formData.is_whitelabel_enabled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                      }`}>
                      {formData.is_whitelabel_enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 font-semibold m-0 mt-1 leading-relaxed">
                    Broadcast an exclusive telematics experience with your corporate logo, custom portal URL, and bespoke brand accents.
                  </p>
                </div>
              </div>

              {/* Modern iOS Style Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  name="is_whitelabel_enabled"
                  checked={formData.is_whitelabel_enabled}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div
                  style={formData.is_whitelabel_enabled ? { backgroundColor: formData.primary_color || '#0284C7' } : {}}
                  className="w-13 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all shadow-inner"
                ></div>
              </label>
            </div>
          </div>

          {/* Card 2: Visual Brand Assets (3-Card Showcase) */}
          <div className="bg-white p-7 rounded-3xl border border-slate-200/90 shadow-sm">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-xs">
                  <ImageIcon className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-wide m-0" style={{ color: '#0F172A' }}>Visual Brand Assets</h3>
                  <p className="text-xs text-slate-600 font-semibold m-0 mt-0.5">Upload high-definition assets for Topbar, Browser Tabs, and Login Screen</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Asset 1: Primary Brand Logo */}
              <div className="flex flex-col p-4.5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:border-slate-400 transition-all shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Brand Logo</span>

                  {/* Light/Dark preview toggle */}
                  <button
                    type="button"
                    onClick={() => setLogoBackdrop(b => b === 'dark' ? 'light' : 'dark')}
                    className="p-1.5 rounded-lg text-slate-800 hover:text-black bg-white border border-slate-300 text-[10.5px] font-black flex items-center gap-1 shadow-2xs"
                    title={`Preview on ${logoBackdrop === 'dark' ? 'Light' : 'Dark'} background`}
                  >
                    {logoBackdrop === 'dark' ? <Moon className="w-3.5 h-3.5 text-indigo-700" /> : <Sun className="w-3.5 h-3.5 text-amber-700" />}
                    <span>{logoBackdrop === 'dark' ? 'Dark Nav' : 'Light'}</span>
                  </button>
                </div>

                <div
                  className={`h-28 rounded-xl flex items-center justify-center p-3 mb-3 relative group overflow-hidden border border-dashed transition-all ${logoBackdrop === 'dark'
                      ? 'bg-[#1E293B] border-slate-700'
                      : 'bg-white border-slate-300 shadow-2xs'
                    }`}
                >
                  {formData.logo_url ? (
                    <img src={formData.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <div className="text-center text-slate-400 text-xs flex flex-col items-center">
                      <ImageIcon className="w-7 h-7 mb-1 text-slate-400 opacity-60" />
                      <span className="text-[11px] font-bold text-slate-600">No logo uploaded</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={uploadingField === 'logo'}
                  onClick={() => logoInputRef.current?.click()}
                  className="w-full h-10 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-black text-slate-800 flex items-center justify-center gap-2 transition-all shadow-xs hover:border-slate-400"
                >
                  {uploadingField === 'logo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-slate-700" />}
                  {formData.logo_url ? 'Replace Brand Logo' : 'Upload Logo'}
                </button>
                <span className="text-[10.5px] text-slate-600 font-semibold text-center mt-2">Recommended: PNG / SVG transparent BG</span>
              </div>

              {/* Asset 2: Browser Favicon */}
              <div className="flex flex-col p-4.5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:border-slate-400 transition-all shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Browser Favicon</span>
                  <span className="text-[10.5px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">32x32</span>
                </div>

                <div className="h-28 bg-white border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-3 mb-3 relative group shadow-2xs">
                  {/* Browser Tab Preview Chip */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200 shadow-2xs max-w-[150px] truncate">
                    {formData.favicon_url || formData.logo_url ? (
                      <img src={formData.favicon_url || formData.logo_url} alt="Favicon" className="w-4 h-4 object-contain rounded-xs flex-shrink-0" />
                    ) : (
                      <div
                        className="w-4 h-4 rounded-xs text-white flex items-center justify-center text-[8px] font-bold flex-shrink-0 shadow-2xs"
                        style={{ backgroundColor: formData.primary_color || '#0284C7' }}
                      >
                        {(formData.brand_name || 'F').slice(0, 1)}
                      </div>
                    )}
                    <span className="text-[11px] font-black text-slate-900 truncate">{formData.brand_name || 'Portal'}</span>
                  </div>
                  <span className="text-[10px] text-slate-600 mt-2 font-bold">Browser tab appearance</span>
                </div>

                <button
                  type="button"
                  disabled={uploadingField === 'favicon'}
                  onClick={() => faviconInputRef.current?.click()}
                  className="w-full h-10 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-black text-slate-800 flex items-center justify-center gap-2 transition-all shadow-xs hover:border-slate-400"
                >
                  {uploadingField === 'favicon' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-slate-700" />}
                  {formData.favicon_url ? 'Replace Favicon' : 'Upload Favicon'}
                </button>
                <span className="text-[10.5px] text-slate-600 font-semibold text-center mt-2">ICO / PNG square icon</span>
              </div>

              {/* Asset 3: Login Screen Banner */}
              <div className="flex flex-col p-4.5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:border-slate-400 transition-all shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Login Banner</span>
                  <span className="text-[10.5px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">1920x1080</span>
                </div>

                <div className="h-28 bg-slate-900 border border-dashed border-slate-600 rounded-xl flex items-center justify-center p-1.5 mb-3 relative group overflow-hidden shadow-2xs">
                  {formData.login_background_url ? (
                    <img src={formData.login_background_url} alt="Login Background" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <div className="text-center text-slate-300 text-xs flex flex-col items-center">
                      <Layout className="w-7 h-7 mb-1 text-slate-400" />
                      <span className="text-[11px] font-bold text-slate-300">Default telematics theme</span>
                    </div>
                  )}
                  {/* Subtle live indicator */}
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9.5px] font-mono font-bold">16:9 HD</div>
                </div>

                <button
                  type="button"
                  disabled={uploadingField === 'background'}
                  onClick={() => bgInputRef.current?.click()}
                  className="w-full h-10 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-black text-slate-800 flex items-center justify-center gap-2 transition-all shadow-xs hover:border-slate-400"
                >
                  {uploadingField === 'background' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-slate-700" />}
                  {formData.login_background_url ? 'Replace Banner' : 'Upload Banner'}
                </button>
                <span className="text-[10.5px] text-slate-600 font-semibold text-center mt-2">Appears on custom login</span>
              </div>
            </div>
          </div>

          {/* Card 3: Brand Identity & Portal Domain */}
          <div className="bg-white p-7 rounded-3xl border border-slate-200/90 shadow-sm">
            <div className="flex items-center gap-3.5 pb-4 mb-6 border-b border-slate-100">
              <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-xs">
                <Globe className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-wide m-0" style={{ color: '#0F172A' }}>Brand Identity &amp; Dedicated Domain</h3>
                <p className="text-xs text-slate-600 font-semibold m-0 mt-0.5">How your dealership is identified by vehicle owners, drivers, and fleet managers</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col">
                <label className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
                  Brand / Portal Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="brand_name"
                  required
                  placeholder="e.g. Apex Telematics"
                  value={formData.brand_name}
                  onChange={handleChange}
                  className="h-12 px-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-sm font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-500/15 transition-all"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
                  Portal Tagline / Slogan
                </label>
                <input
                  type="text"
                  name="brand_tagline"
                  placeholder="e.g. Smart GPS Tracking & Fuel Intelligence"
                  value={formData.brand_tagline}
                  onChange={handleChange}
                  className="h-12 px-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-sm font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-500/15 transition-all"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2 flex items-center justify-between">
                  <span>Portal Subdomain Slug</span>
                  <span className="text-xs font-black text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-300">
                    <Shield className="w-3.5 h-3.5 text-emerald-600" /> SSL Secured
                  </span>
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    name="subdomain"
                    placeholder="apextelematics"
                    value={formData.subdomain}
                    onChange={handleChange}
                    className="h-12 px-4 bg-slate-50 border-2 border-r-0 border-slate-300 rounded-l-2xl text-sm font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-500/15 transition-all flex-1"
                  />
                  <span className="h-12 px-4 bg-slate-100 border-2 border-slate-300 rounded-r-2xl text-xs font-black text-slate-800 flex items-center">
                    .fueltracks.com
                  </span>
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
                  Portal Footer Copyright
                </label>
                <input
                  type="text"
                  name="footer_text"
                  placeholder="© 2026 Apex Telematics. All rights reserved."
                  value={formData.footer_text}
                  onChange={handleChange}
                  className="h-12 px-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-sm font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-500/15 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Card 4: Theme Color Studio & Palettes */}
          <div className="bg-white p-7 rounded-3xl border border-slate-200/90 shadow-sm">
            <div className="flex items-center gap-3.5 pb-4 mb-6 border-b border-slate-100">
              <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-xs">
                <Palette className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-wide m-0" style={{ color: '#0F172A' }}>Theme Colors &amp; Accent Studio</h3>
                <p className="text-xs text-slate-600 font-semibold m-0 mt-0.5">Synchronize your primary action buttons, active navigation pills, and topbar palette</p>
              </div>
            </div>

            {/* Curated Theme Presets */}
            <div className="mb-6">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800 mb-3 block">
                Executive Curated Palettes
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {PRESET_COLORS.map(preset => {
                  const isSelected = formData.primary_color.toLowerCase() === preset.primary.toLowerCase() &&
                    formData.secondary_color.toLowerCase() === preset.secondary.toLowerCase();
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleColorPreset(preset)}
                      className={`flex items-center gap-3.5 p-3.5 rounded-2xl border-2 transition-all text-left ${isSelected
                          ? 'border-slate-900 bg-slate-100 shadow-md ring-2 ring-slate-400/25 -translate-y-0.5'
                          : 'border-slate-200 hover:border-slate-400 bg-white hover:bg-slate-50/50'
                        }`}
                    >
                      <div className="flex -space-x-2 flex-shrink-0">
                        <div className="w-7 h-7 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: preset.primary }} />
                        <div className="w-7 h-7 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: preset.secondary }} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-black text-slate-900 block truncate">{preset.name}</span>
                        <span className="text-[11px] text-slate-600 font-bold block truncate">{preset.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Hex Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              <div className="flex flex-col">
                <label className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
                  Primary Accent Color (Pills, Buttons, Active Badges)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    name="primary_color"
                    value={formData.primary_color}
                    onChange={handleChange}
                    className="w-12 h-12 rounded-2xl cursor-pointer border-2 border-slate-300 p-1 bg-white shadow-xs"
                  />
                  <input
                    type="text"
                    name="primary_color"
                    value={formData.primary_color}
                    onChange={handleChange}
                    placeholder="#0284C7"
                    className="h-12 px-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-sm font-mono font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-500/15 uppercase flex-1"
                  />
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
                  Secondary Theme Color (Topbar &amp; Navigation Bars)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    name="secondary_color"
                    value={formData.secondary_color}
                    onChange={handleChange}
                    className="w-12 h-12 rounded-2xl cursor-pointer border-2 border-slate-300 p-1 bg-white shadow-xs"
                  />
                  <input
                    type="text"
                    name="secondary_color"
                    value={formData.secondary_color}
                    onChange={handleChange}
                    placeholder="#0F172A"
                    className="h-12 px-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-sm font-mono font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-500/15 uppercase flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 5: Customer Support Hotline */}
          <div className="bg-white p-7 rounded-3xl border border-slate-200/90 shadow-sm">
            <div className="flex items-center gap-3.5 pb-4 mb-6 border-b border-slate-100">
              <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-xs">
                <Smartphone className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-wide m-0" style={{ color: '#0F172A' }}>Customer Support Channels</h3>
                <p className="text-xs text-slate-600 font-semibold m-0 mt-0.5">Displayed in customer portal footers, driver app alerts, and billing receipts</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col">
                <label className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
                  Support Hotline / Phone
                </label>
                <input
                  type="tel"
                  name="support_phone"
                  placeholder="+91 98765 43210"
                  value={formData.support_phone}
                  onChange={handleChange}
                  className="h-12 px-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-sm font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-500/15 transition-all"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
                  Support Email Address
                </label>
                <input
                  type="email"
                  name="support_email"
                  placeholder="support@apextelematics.com"
                  value={formData.support_email}
                  onChange={handleChange}
                  className="h-12 px-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-sm font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-500/15 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Save Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-3.5 mt-3">
            <button
              type="button"
              disabled={loading}
              onClick={(e) => handleSubmit(e, false)}
              className="px-7 h-12 flex items-center justify-center text-xs font-black text-slate-800 bg-white hover:bg-slate-100 border-2 border-slate-300 rounded-2xl transition-all shadow-xs disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2 text-slate-700" />
              Save Branding Only
            </button>
            <button
              type="submit"
              disabled={loading}
              onClick={(e) => handleSubmit(e, true)}
              style={{ backgroundColor: formData.primary_color || '#0284C7' }}
              className="px-9 h-12 flex items-center justify-center text-xs font-black text-white rounded-2xl shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save &amp; Continue to Contacts →
            </button>
          </div>
        </form>
      </div>

      {/* Right Column: Live Interactive Dual Preview Showcase */}
      <div className="w-full xl:w-[40%] flex flex-col gap-6 sticky top-8">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-lg">
          {/* Header & Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" style={{ color: formData.primary_color || '#0284C7' }} />
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900">Live Portal Simulation</span>
            </div>

            {/* Toggle: Dashboard vs Login */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setPreviewMode('dashboard')}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${previewMode === 'dashboard'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('login')}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${previewMode === 'login'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                Login Page
              </button>
            </div>
          </div>

          {/* Simulated High-Res Browser Window */}
          <div className="border border-slate-300/80 rounded-2xl overflow-hidden shadow-xl bg-slate-900">
            {/* macOS Browser Header Bar */}
            <div className="bg-slate-800/90 px-3.5 pt-2.5 pb-0 flex items-center gap-2 border-b border-slate-700/80">
              <div className="flex gap-1.5 mr-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </div>

              {/* Active Tab */}
              <div className="bg-slate-900 px-3 py-1.5 rounded-t-xl border-t border-l border-r border-slate-700 flex items-center gap-2 text-[11px] font-bold text-white shadow-xs max-w-[220px] truncate">
                {formData.favicon_url || formData.logo_url ? (
                  <img src={formData.favicon_url || formData.logo_url} alt="Favicon" className="w-3.5 h-3.5 object-contain rounded-xs flex-shrink-0" />
                ) : (
                  <div
                    className="w-3.5 h-3.5 rounded-xs text-white flex items-center justify-center text-[8px] font-bold flex-shrink-0"
                    style={{ backgroundColor: formData.primary_color || '#0284C7' }}
                  >
                    {(formData.brand_name || 'F').slice(0, 1)}
                  </div>
                )}
                <span className="truncate">{formData.brand_name || 'Dealership Portal'}</span>
              </div>
            </div>

            {/* Address Bar */}
            <div className="bg-slate-900 px-3.5 py-1.5 border-b border-slate-800 flex items-center gap-2">
              <Lock className="w-3 h-3 text-emerald-400" />
              <div className="bg-slate-800/90 px-3 py-0.5 rounded-lg text-[10.5px] font-mono text-slate-300 flex-1 truncate border border-slate-700/70">
                https://{formData.subdomain || 'portal'}.fueltracks.com/{previewMode === 'login' ? 'login' : 'dashboard'}
              </div>
            </div>

            {/* Conditional Simulation Content: Dashboard vs Login */}
            {previewMode === 'dashboard' ? (
              <div className="bg-slate-50 min-h-[340px] flex flex-col justify-between">
                {/* Topbar Simulation */}
                <div>
                  <div
                    className="p-3.5 px-4 flex items-center justify-between text-white transition-colors duration-300 shadow-md"
                    style={{ backgroundColor: formData.secondary_color || '#0F172A' }}
                  >
                    <div className="flex items-center gap-2.5">
                      {formData.logo_url ? (
                        <img src={formData.logo_url} alt="Logo" className="h-6 max-w-[110px] object-contain" />
                      ) : (
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs text-white shadow-xs"
                          style={{ backgroundColor: formData.primary_color || '#0284C7' }}
                        >
                          {(formData.brand_name || 'FT').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-black leading-none">{formData.brand_name || 'Dealership Portal'}</div>
                        <div className="text-[9px] opacity-80 leading-none mt-1 truncate max-w-[130px]">
                          {formData.brand_tagline || 'Fleet Telematics'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div
                        className="px-2.5 py-0.5 rounded-md text-[9px] font-extrabold text-white shadow-2xs"
                        style={{ backgroundColor: formData.primary_color || '#0284C7' }}
                      >
                        Live Telematics
                      </div>
                    </div>
                  </div>

                  {/* Dashboard Cards Simulation */}
                  <div className="p-4 space-y-3">
                    <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Fleet Node</div>
                        <div className="text-sm font-black text-slate-900 mt-0.5">48 Vehicles Online</div>
                      </div>
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-xs"
                        style={{ backgroundColor: formData.primary_color || '#0284C7' }}
                      >
                        ✓
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs">
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Fuel Sensor</span>
                        <span className="text-xs font-extrabold text-slate-800">94.2% Level</span>
                      </div>
                      <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs">
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">GPS Accuracy</span>
                        <span className="text-xs font-extrabold text-emerald-600">0.8m HDOP</span>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs flex items-center justify-between text-[11px] text-slate-600">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                        {formData.support_phone || '+91 Support Hotline'}
                      </span>
                      <span className="font-extrabold text-emerald-600 text-[10px]">24/7 Active</span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-2.5 bg-slate-100 border-t border-slate-200 text-center text-[10px] text-slate-500 font-medium truncate px-4">
                  {formData.footer_text || '© 2026 Dealership Telematics. All rights reserved.'}
                </div>
              </div>
            ) : (
              /* Login Page Simulation */
              <div
                className="relative min-h-[340px] flex items-center justify-center p-5 overflow-hidden bg-cover bg-center"
                style={{
                  backgroundImage: formData.login_background_url
                    ? `url(${formData.login_background_url})`
                    : 'linear-gradient(to bottom right, #0F172A, #1E293B)'
                }}
              >
                {/* Dark Glass Overlay */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" />

                {/* Mini Login Card */}
                <div className="relative z-10 w-full max-w-[240px] bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-white/30 text-center">
                  {formData.logo_url ? (
                    <img src={formData.logo_url} alt="Logo" className="h-7 max-w-[120px] object-contain mx-auto mb-2" />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-xl mx-auto mb-2 flex items-center justify-center font-black text-xs text-white shadow-xs"
                      style={{ backgroundColor: formData.primary_color || '#0284C7' }}
                    >
                      {(formData.brand_name || 'FT').slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <h5 className="text-xs font-extrabold text-slate-900 m-0">{formData.brand_name || 'Dealer Portal'}</h5>
                  <p className="text-[9px] text-slate-500 m-0 mt-0.5 truncate">{formData.brand_tagline || 'Sign in to your account'}</p>

                  <div className="space-y-1.5 my-3 text-left">
                    <div className="h-6 px-2 bg-slate-100 rounded border border-slate-200 text-[9px] text-slate-400 flex items-center">
                      fleet.manager@domain.com
                    </div>
                    <div className="h-6 px-2 bg-slate-100 rounded border border-slate-200 text-[9px] text-slate-400 flex items-center">
                      ••••••••••••
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full h-7 rounded-lg text-white font-extrabold text-[10px] shadow-sm flex items-center justify-center transition-all"
                    style={{ backgroundColor: formData.primary_color || '#0284C7' }}
                  >
                    Sign In to Portal
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Value Proposition Highlights Box */}
        <div className="bg-gradient-to-br from-slate-900/5 via-sky-500/5 to-transparent p-6 rounded-3xl border border-slate-200/90 shadow-sm">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-600" />
            Enterprise White-Label Advantages
          </h4>
          <ul className="space-y-2.5 text-xs font-semibold text-slate-700">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span>Full brand autonomy across login, topbar navigation, and alert emails</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span>Dedicated portal subdomain for your fleet customers</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span>Zero third-party vendor mentions in your customer dashboard</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Floating Unsaved Save Toolbar when Dirty */}
      {isDirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 p-3.5 px-6 rounded-2xl shadow-2xl z-50 flex items-center gap-6 animate-in slide-in-from-bottom-6 duration-300">
          <div className="flex items-center gap-3">
            <div
              className="w-2.5 h-2.5 rounded-full animate-ping"
              style={{ backgroundColor: formData.primary_color || '#0284C7' }}
            />
            <span className="text-xs font-extrabold text-white">Unsaved white-label customizations</span>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            style={{ backgroundColor: formData.primary_color || '#0284C7' }}
            className="px-5 h-9 flex items-center justify-center text-xs font-black text-white rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
};

export default WhiteLabelTab;
