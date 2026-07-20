import React, { useState, useRef, useEffect } from 'react';
import { Upload, Loader2, Image as ImageIcon, Trash2, Layout, RefreshCw, Save, PaintBucket } from 'lucide-react';

const UploadBox = ({ title, description, type, currentUrl, inputRef, loading, onUpload, onDelete, API_URL }) => {
  return (
    <div className="flex flex-col">
      <label className="text-[14px] font-medium !text-black mb-[8px]">{title}</label>
      <div
        onClick={() => inputRef.current.click()}
        className="w-full border-2 border-dashed border-[#E5E7EB] rounded-[10px] p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer hover:bg-[#FFF5EB] hover:border-[#FF6A00]/50 h-[160px]"
      >
        {currentUrl ? (
          <div className="relative w-full h-full rounded-lg bg-white shadow-sm flex items-center justify-center p-2 group">
            <img src={`${API_URL}${currentUrl}`} alt={title} className="max-w-full max-h-full object-contain" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
              <span className="text-white text-[13px] font-semibold">Click to Replace</span>
            </div>
          </div>
        ) : (
          <>
            <div className="w-[44px] h-[44px] rounded-full bg-[#FFF5EB] flex items-center justify-center mb-3 shadow-sm border border-orange-100">
              <ImageIcon className="w-[20px] h-[20px] text-[#FF6A00]" />
            </div>
            <p className="text-[14px] font-semibold !text-black mb-1">Click to Upload</p>
            <p className="text-[12px] !text-black">PNG, JPG up to 5MB</p>
          </>
        )}

        <input
          type="file"
          ref={inputRef}
          onChange={(e) => onUpload(type, e.target.files[0])}
          className="hidden"
          accept=".png,.jpg,.jpeg,.svg"
        />
      </div>

      <div className="flex justify-between items-center mt-2 h-5">
        <div className="flex items-center gap-2">
          {loading[type] && <Loader2 className="w-4 h-4 animate-spin text-[#7C3AED]" />}
          <span className="text-[12px] font-medium !text-black">
            {loading[type] ? 'Uploading...' : currentUrl ? 'Active Image' : ''}
          </span>
        </div>
        {currentUrl && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete && onDelete(type); }} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

const SectionHeader = ({ icon: Icon, title, description, tint = 'bg-[#F5F3FF]', iconColor = 'text-[#7C3AED]' }) => (
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

const BrandingTab = ({ profile, onUpload, onSave }) => {
  const [loading, setLoading] = useState({ logo: false, favicon: false, background: false });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const initialColors = {
    primary: profile?.primary_color || '#FF6A00',
    secondary: profile?.secondary_color || '#163B63',
    accent: profile?.accent_color || '#16A34A'
  };

  const [colors, setColors] = useState(initialColors);
  const [savingColors, setSavingColors] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const dirty = JSON.stringify(colors) !== JSON.stringify(initialColors);
    setIsDirty(dirty);
  }, [colors, profile]);

  const logoRef = useRef(null);
  const faviconRef = useRef(null);
  const backgroundRef = useRef(null);

  const handleUpload = async (type, file) => {
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Only JPEG, PNG, JPG, and SVG are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB.');
      return;
    }

    setLoading(prev => ({ ...prev, [type]: true }));
    setError('');
    setSuccess('');

    const res = await onUpload(type, file);
    if (res.success) {
      setSuccess(`${type === 'background' ? 'Login Background' : type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully!`);
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(res.error || 'Upload failed');
    }

    setLoading(prev => ({ ...prev, [type]: false }));
  };
  
  const handleDelete = async (type) => {
    if (!onSave) return;
    setLoading(prev => ({ ...prev, [type]: true }));
    setError('');
    
    // Clear out the url
    const payload = {};
    if (type === 'logo') payload.logo_url = null;
    if (type === 'favicon') payload.favicon_url = null;
    if (type === 'background') payload.login_background_url = null;
    
    const res = await onSave(payload);
    if (res.success) {
      setSuccess('Image deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(res.error || 'Failed to delete image');
    }
    setLoading(prev => ({ ...prev, [type]: false }));
  };

  const handleColorChange = (key, val) => {
    setColors(prev => ({ ...prev, [key]: val }));
  };

  const handleReset = () => {
    setColors(initialColors);
    setError('');
    setSuccess('');
    setIsDirty(false);
  };

  const handleSaveColors = async (e) => {
    if (e) e.preventDefault();
    if (!onSave) return;

    setSavingColors(true);
    setError('');
    setSuccess('');

    const res = await onSave({
      primary_color: colors.primary,
      secondary_color: colors.secondary,
      accent_color: colors.accent
    });

    if (res.success) {
      setSuccess('Brand colors updated successfully!');
      setIsDirty(false);
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(res.error || 'Failed to update brand colors');
    }
    setSavingColors(false);
  };

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  return (
    <div className="flex flex-col lg:flex-row gap-[20px] items-start w-full relative pb-[100px]">

      {/* Main Content Area (~68% of the remaining 78% page space) */}
      <div className="w-full lg:w-[68%]">

        {/* Alerts */}
        {error && <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-[14px] text-[14px] mb-[20px] shadow-sm">{error}</div>}
        {success && <div className="p-4 bg-[#ECFDF5] border border-green-200 text-[#16A34A] rounded-[14px] text-[14px] mb-[20px] shadow-sm">{success}</div>}

        <div className="flex flex-col gap-[20px]">

          {/* Logo Upload Section */}
          <div className="bg-[#FFFFFF] p-[24px] pt-0 rounded-[14px] border border-[#E5E7EB] shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow">
            <SectionHeader icon={ImageIcon} title="Organization Logos" description="Upload logos for headers, navigation, and login screens." />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-[20px] mt-[24px]">
              <UploadBox
                title="Main Logo"
                type="logo"
                currentUrl={profile?.logo_url}
                inputRef={logoRef}
                loading={loading}
                onUpload={handleUpload}
                onDelete={handleDelete}
                API_URL={API_URL}
              />
              <UploadBox
                title="Login Background"
                type="background"
                currentUrl={profile?.login_background_url}
                inputRef={backgroundRef}
                loading={loading}
                onUpload={handleUpload}
                onDelete={handleDelete}
                API_URL={API_URL}
              />
              <UploadBox
                title="Favicon"
                type="favicon"
                currentUrl={profile?.favicon_url}
                inputRef={faviconRef}
                loading={loading}
                onUpload={handleUpload}
                onDelete={handleDelete}
                API_URL={API_URL}
              />
            </div>
          </div>

          {/* Brand Colors Section */}
          <form onSubmit={handleSaveColors} className="bg-[#FFFFFF] p-[24px] pt-0 rounded-[14px] border border-[#E5E7EB] shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow">
            <SectionHeader icon={PaintBucket} title="Brand Colors" description="Select primary colors to customize the application UI." />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-[20px] mt-[24px]">
              <div>
                <label className="block text-[14px] font-medium !text-black mb-[8px]">Primary Color</label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="color"
                      value={colors.primary}
                      onChange={(e) => handleColorChange('primary', e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="w-[48px] h-[48px] rounded-[10px] border border-[#E5E7EB] shadow-sm flex items-center justify-center cursor-pointer" style={{ backgroundColor: colors.primary }}></div>
                  </div>
                  <input
                    type="text"
                    value={colors.primary}
                    onChange={(e) => handleColorChange('primary', e.target.value)}
                    className="h-[48px] w-full px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[15px] font-medium uppercase !text-black focus:outline-none focus:border-[#7C3AED] focus:ring-4 focus:ring-purple-500/10 hover:border-[#D1D5DB] transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[14px] font-medium !text-black mb-[8px]">Secondary Color</label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="color"
                      value={colors.secondary}
                      onChange={(e) => handleColorChange('secondary', e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="w-[48px] h-[48px] rounded-[10px] border border-[#E5E7EB] shadow-sm flex items-center justify-center cursor-pointer" style={{ backgroundColor: colors.secondary }}></div>
                  </div>
                  <input
                    type="text"
                    value={colors.secondary}
                    onChange={(e) => handleColorChange('secondary', e.target.value)}
                    className="h-[48px] w-full px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[15px] font-medium uppercase !text-black focus:outline-none focus:border-[#7C3AED] focus:ring-4 focus:ring-purple-500/10 hover:border-[#D1D5DB] transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[14px] font-medium !text-black mb-[8px]">Accent Color</label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="color"
                      value={colors.accent}
                      onChange={(e) => handleColorChange('accent', e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="w-[48px] h-[48px] rounded-[10px] border border-[#E5E7EB] shadow-sm flex items-center justify-center cursor-pointer" style={{ backgroundColor: colors.accent }}></div>
                  </div>
                  <input
                    type="text"
                    value={colors.accent}
                    onChange={(e) => handleColorChange('accent', e.target.value)}
                    className="h-[48px] w-full px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[15px] font-medium uppercase !text-black focus:outline-none focus:border-[#7C3AED] focus:ring-4 focus:ring-purple-500/10 hover:border-[#D1D5DB] transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Natural Actions */}
            <div className="flex justify-end gap-3 mt-6">

              <button
                type="submit"
                disabled={savingColors}
                className="px-6 h-[48px] flex items-center justify-center text-[15px] font-semibold text-white bg-gradient-to-r from-[#FF6A00] to-[#FF8A33] rounded-[10px] shadow-[0_4px_12px_rgba(255,106,0,0.3)] hover:shadow-[0_6px_16px_rgba(255,106,0,0.4)] transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {savingColors ? <Loader2 className="w-[20px] h-[20px] mr-2 animate-spin" /> : <Save className="w-[20px] h-[20px] mr-2" />}
                Save Colors
              </button>
            </div>
          </form>

        </div>
      </div>

      {/* Right Information Panel (~32% of the remaining 78% page space) */}
      <div className="w-full lg:w-[32%] flex-shrink-0">
        <div className="bg-[#FFFFFF] p-[24px] rounded-[14px] border border-[#E5E7EB] shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow sticky top-[24px]">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#F5F3FF] -mx-[24px] px-[24px] -mt-[24px] pt-[20px] bg-[#F5F3FF] rounded-t-[14px]">
            <div className="p-1.5 bg-white rounded-lg shadow-sm">
              <Layout className="w-[18px] h-[18px] text-[#7C3AED]" />
            </div>
            <h3 className="text-[16px] font-semibold !text-black m-0">Live Theme Preview</h3>
          </div>

          <div className="space-y-6 mt-[20px]">
            {/* Header Preview */}
            <div>
              <h4 className="text-[12px] font-bold !text-black uppercase tracking-wider mb-2">App Header</h4>
              <div className="h-12 rounded-xl flex items-center px-4 shadow-sm border border-[#E5E7EB]" style={{ backgroundColor: colors.secondary }}>
                <div className="w-24 h-4 rounded bg-white/20"></div>
                <div className="ml-auto flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/10"></div>
                  <div className="w-6 h-6 rounded-full bg-white/10"></div>
                </div>
              </div>
            </div>

            {/* Sidebar Preview */}
            <div>
              <h4 className="text-[12px] font-bold !text-black uppercase tracking-wider mb-2">Sidebar Active Item</h4>
              <div className="relative rounded-xl p-3 flex items-center overflow-hidden border border-[#E5E7EB] bg-white shadow-sm">
                <div className="absolute left-0 top-0 bottom-0 w-[4px]" style={{ backgroundColor: colors.primary }}></div>
                <div className="w-[32px] h-[32px] rounded-lg mr-3 flex items-center justify-center bg-gray-50 border border-gray-100">
                  <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: colors.primary }}></div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="w-20 h-2.5 rounded" style={{ backgroundColor: colors.primary }}></div>
                  <div className="w-12 h-1.5 rounded bg-gray-200"></div>
                </div>
              </div>
            </div>

            {/* Buttons Preview */}
            <div>
              <h4 className="text-[12px] font-bold !text-black uppercase tracking-wider mb-2">Primary Button</h4>
              <button
                className="w-full h-[48px] rounded-[10px] flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.1)] opacity-95 hover:opacity-100 transform hover:-translate-y-0.5 transition-all"
                style={{ backgroundColor: colors.primary }}
              >
                <span className="text-[15px] font-bold text-white">Action Button</span>
              </button>
            </div>

            {/* Typography Preview */}
            <div>
              <h4 className="text-[12px] font-bold !text-black uppercase tracking-wider mb-2">Typography & Links</h4>
              <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]">
                <h5 className="text-[16px] font-bold !text-black mb-1">Heading Text</h5>
                <p className="text-[13px] font-medium !text-black mb-3">Secondary text for descriptions.</p>
                <div className="text-[14px] font-semibold hover:underline cursor-pointer flex items-center gap-1" style={{ color: colors.accent }}>
                  Accent Link Text <span aria-hidden="true">&rarr;</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Sticky Save Bar */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-50 flex justify-center animate-in slide-in-from-bottom-full duration-300">
          <div className="max-w-[1200px] w-full flex flex-col sm:flex-row sm:items-center justify-between px-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#F5F3FF] rounded-full">
                <RefreshCw className="w-5 h-5 text-[#7C3AED]" />
              </div>
              <div>
                <h4 className="text-[15px] font-semibold !text-black m-0">You have unsaved changes</h4>
                <p className="text-[14px] !text-black m-0">Please save or reset your changes.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">

              <button
                type="button"
                onClick={handleSaveColors}
                disabled={savingColors}
                className="px-6 h-[48px] flex items-center text-[15px] font-semibold text-white bg-gradient-to-r from-[#FF6A00] to-[#FF8A33] rounded-[10px] shadow-[0_4px_12px_rgba(255,106,0,0.3)] hover:shadow-[0_6px_16px_rgba(255,106,0,0.4)] transform hover:-translate-y-0.5 transition-all disabled:opacity-50"
              >
                {savingColors ? <Loader2 className="w-[20px] h-[20px] mr-2 animate-spin" /> : <Save className="w-[20px] h-[20px] mr-2" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrandingTab;