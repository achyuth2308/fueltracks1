import React, { useState, useRef } from 'react';
import { Upload, Loader2, Image as ImageIcon } from 'lucide-react';

const BrandingTab = ({ profile, onUpload }) => {
  const [loading, setLoading] = useState({ logo: false, favicon: false, background: false });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const logoRef = useRef(null);
  const faviconRef = useRef(null);
  const backgroundRef = useRef(null);

  const handleUpload = async (type, file) => {
    if (!file) return;
    
    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Only JPEG, PNG, JPG, and SVG are allowed.');
      return;
    }

    setLoading(prev => ({ ...prev, [type]: true }));
    setError('');
    setSuccess('');

    const res = await onUpload(type, file);
    if (res.success) {
      setSuccess(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully!`);
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(res.error || 'Upload failed');
    }

    setLoading(prev => ({ ...prev, [type]: false }));
  };

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const renderUploadBox = (title, type, currentUrl, inputRef) => (
    <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 bg-[#F8FAFC] flex flex-col hover:bg-slate-100 transition-colors cursor-pointer items-center justify-center text-center">
      <h4 className="text-md font-medium mb-4" style={{ color: '#111827', margin: '0 0 16px 0' }}>{title}</h4>
      
      {currentUrl ? (
        <div className="mb-4 w-32 h-32 relative rounded-md overflow-hidden bg-white shadow-sm flex items-center justify-center">
          <img src={`${API_URL}${currentUrl}`} alt={title} className="max-w-full max-h-full object-contain" />
        </div>
      ) : (
        <div className="mb-4 w-32 h-32 rounded-md bg-gray-200 flex items-center justify-center" style={{ color: '#6B7280' }}>
          <ImageIcon className="w-10 h-10" />
        </div>
      )}

      <input
        type="file"
        ref={inputRef}
        onChange={(e) => handleUpload(type, e.target.files[0])}
        className="hidden"
        accept=".png,.jpg,.jpeg,.svg"
      />
      
      <button
        type="button"
        onClick={() => inputRef.current.click()}
        disabled={loading[type]}
        className="flex items-center px-4 py-2 bg-white border border-slate-300 rounded-xl font-medium shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#f97316] disabled:opacity-50 transition-colors"
        style={{ color: '#374151' }}
      >
        {loading[type] ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
        {currentUrl ? 'Change' : 'Upload'}
      </button>
      <p className="text-xs mt-3" style={{ color: '#6B7280', margin: '12px 0 0 0' }}>PNG, JPG, SVG up to 5MB</p>
    </div>
  );

  return (
    <div className="bg-white p-6 sm:p-10 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200">
      <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111827", margin: 0, letterSpacing: "-0.01em", marginBottom: "24px" }}>Branding Configuration</h2>
      
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md text-sm">{success}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {renderUploadBox('Main Logo', 'logo', profile?.logo_url, logoRef)}
        {renderUploadBox('Favicon', 'favicon', profile?.favicon_url, faviconRef)}
        {renderUploadBox('Login Background', 'background', profile?.login_background_url, backgroundRef)}
      </div>
    </div>
  );
};

export default BrandingTab;
