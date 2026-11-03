import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Eye, EyeOff, ExternalLink, ShieldCheck, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  formatWhatsAppCredentialsMessage,
  normalizeWhatsAppPhone,
  openWhatsAppCredentialsShare
} from '../../utils/whatsappShare';
import { sendUserCredentialsWhatsApp } from '../../api/adminApi';

// Inline WhatsApp SVG Icon
const WhatsAppIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

const SendCredentialsModal = ({
  isOpen,
  onClose,
  initialUser = null, // { name, username, phone, password }
  isNewlyCreated = false
}) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [apiLoading, setApiLoading] = useState(false);
  const [apiSuccess, setApiSuccess] = useState(null);
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    if (initialUser) {
      setName(initialUser.name || '');
      setUsername(initialUser.username || '');
      setPhone(initialUser.phone || '');
      const initialPass = initialUser.password || initialUser.temp_password;
      setPassword(initialPass && initialPass !== '—' ? initialPass : '223344');
    } else {
      setName('');
      setUsername('');
      setPhone('');
      setPassword('223344');
    }
    setCopied(false);
    setPhoneError('');
    setShowPassword(false);
    setApiLoading(false);
    setApiSuccess(null);
    setApiError(null);
  }, [initialUser, isOpen]);

  if (!isOpen) return null;

  const normalizedDigits = normalizeWhatsAppPhone(phone);
  const previewMessage = formatWhatsAppCredentialsMessage({ name, username, password });

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(previewMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const handleSendWhatsApp = () => {
    if (!normalizedDigits) {
      setPhoneError('Please enter a valid mobile number (e.g., 9876543210).');
      return;
    }
    setPhoneError('');
    openWhatsAppCredentialsShare({
      phone: normalizedDigits,
      name,
      username,
      password
    });
  };

  const handleSendMetaApi = async () => {
    if (!normalizedDigits) {
      setPhoneError('Please enter a valid mobile number (e.g., 9876543210).');
      return;
    }
    const targetUserId = initialUser?.id || initialUser?._id;
    if (!targetUserId) {
      setApiError('User ID not found for Meta API dispatch. Please use "Open in WhatsApp".');
      return;
    }
    setPhoneError('');
    setApiLoading(true);
    setApiSuccess(null);
    setApiError(null);

    try {
      const res = await sendUserCredentialsWhatsApp(targetUserId, {
        phone: normalizedDigits
      });
      if (res?.success) {
        if (res.mock) {
          setApiSuccess('Dev Mock dispatched! (To send real live messages, configure WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in your .env file).');
        } else {
          setApiSuccess(res.message || 'WhatsApp template dispatched to customer via Meta Cloud API!');
        }
      } else {
        setApiError(res?.error || 'Failed to dispatch via Meta API');
      }
    } catch (err) {
      setApiError(err.response?.data?.error || err.message || 'Error dispatching Meta WhatsApp message');
    } finally {
      setApiLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          animation: 'modalSlideUp 0.25s ease-out'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: isNewlyCreated ? '#F0FDF4' : '#FAFAFA'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#25D366',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '0 4px 6px -1px rgba(37, 211, 102, 0.3)'
              }}
            >
              <WhatsAppIcon size={22} color="#FFFFFF" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                {isNewlyCreated ? 'User Created! Send Credentials' : 'Send Credentials via WhatsApp'}
              </h3>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>
                Opens directly in WhatsApp with customer phone and message pre-filled.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isNewlyCreated && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#065F46',
                fontSize: '12.5px',
                fontWeight: 600
              }}
            >
              <ShieldCheck size={16} color="#059669" />
              <span>Customer account created successfully in FuelTracks!</span>
            </div>
          )}

          {/* Form Inputs Grid - Customer Name & Phone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Customer Name */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>
                Customer Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Akkini"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  color: '#1E293B',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Mobile Number */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>
                WhatsApp Number <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (phoneError) setPhoneError('');
                }}
                placeholder="e.g. 9876543210"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: phoneError ? '1px solid #EF4444' : '1px solid #CBD5E1',
                  fontSize: '13px',
                  color: '#1E293B',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {normalizedDigits && (
                <span style={{ fontSize: '10.5px', color: '#16A34A', marginTop: '2px', display: 'block' }}>
                  Target: +{normalizedDigits}
                </span>
              )}
              {phoneError && (
                <span style={{ fontSize: '11px', color: '#EF4444', marginTop: '2px', display: 'block' }}>
                  {phoneError}
                </span>
              )}
            </div>
          </div>

          {/* Verified Database Credentials (Read-only from DB) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              fontSize: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
              <ShieldCheck size={15} color="#0284C7" />
              <span style={{ fontWeight: 600 }}>Database Account Credentials:</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#1E293B', fontSize: '12.5px' }}>
              <span>User ID: <strong style={{ fontFamily: 'monospace', color: '#0369A1' }}>{username || '—'}</strong></span>
              <span>Password: <strong style={{ fontFamily: 'monospace', color: '#059669' }}>{password || '223344'}</strong></span>
            </div>
          </div>

          {/* Live Message Preview */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                WhatsApp Message Preview
              </span>
              <button
                type="button"
                onClick={handleCopyMessage}
                style={{
                  background: copied ? '#ECFDF5' : '#F1F5F9',
                  border: 'none',
                  color: copied ? '#059669' : '#475569',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied to Clipboard' : 'Copy Text'}
              </button>
            </div>
            <div
              style={{
                background: '#EFEAE2', // WhatsApp chat background color
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid #E2D9CE'
              }}
            >
              <div
                style={{
                  background: '#FFFFFF',
                  padding: '12px 14px',
                  borderRadius: '8px 8px 8px 2px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  fontSize: '12.5px',
                  lineHeight: '1.6',
                  color: '#111827',
                  whiteSpace: 'pre-wrap',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
                }}
              >
                {previewMessage}
              </div>
            </div>
          </div>

          {apiSuccess && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#065F46',
                fontSize: '12.5px',
                fontWeight: 600
              }}
            >
              <CheckCircle2 size={16} color="#059669" />
              <span>{apiSuccess}</span>
            </div>
          )}

          {apiError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#991B1B',
                fontSize: '12.5px',
                fontWeight: 600
              }}
            >
              <AlertCircle size={16} color="#DC2626" />
              <span>{apiError}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #F1F5F9',
            background: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {isNewlyCreated ? 'Done / Skip' : 'Cancel'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Option A: Manual WhatsApp Web / App */}
            <button
              type="button"
              onClick={handleSendWhatsApp}
              title="Open WhatsApp on this device with message pre-typed"
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid #BBF7D0',
                background: '#F0FDF4',
                color: '#15803D',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <WhatsAppIcon size={16} color="#15803D" />
              <span>Open in WhatsApp</span>
              <ExternalLink size={13} color="#15803D" style={{ opacity: 0.8 }} />
            </button>

            {/* Option B: Direct Meta Cloud API Dispatch */}
            <button
              type="button"
              onClick={handleSendMetaApi}
              disabled={apiLoading}
              title="Send approved Utility template via official Meta Cloud API"
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: 'none',
                background: '#25D366',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 700,
                cursor: apiLoading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 10px rgba(37, 211, 102, 0.35)',
                transition: 'background 0.2s, transform 0.1s'
              }}
              onMouseEnter={(e) => { if (!apiLoading) e.currentTarget.style.background = '#20bd5a'; }}
              onMouseLeave={(e) => { if (!apiLoading) e.currentTarget.style.background = '#25D366'; }}
            >
              {apiLoading ? (
                <Loader2 size={16} className="animate-spin" color="#FFFFFF" />
              ) : (
                <Send size={15} color="#FFFFFF" />
              )}
              <span>Send via Meta API</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SendCredentialsModal;

