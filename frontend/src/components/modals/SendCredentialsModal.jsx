import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Eye, EyeOff, ExternalLink, ShieldCheck, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  formatWhatsAppCredentialsMessage,
  normalizeWhatsAppPhone,
  openWhatsAppCredentialsShare
} from '../../utils/whatsappShare';
import { sendUserCredentialsWhatsApp } from '../../api/adminApi';
import { useAuth } from '../../context/AuthContext';

// Inline Official WhatsApp SVG Icon
const WhatsAppIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ color, flexShrink: 0 }}
  >
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.05 20.16C10.57 20.16 9.12 19.76 7.85 19.01L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.98 3.8 13.47 3.8 11.91C3.8 7.37 7.5 3.67 12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.16 12.05 20.16ZM16.57 14.39C16.32 14.27 15.1 13.67 14.88 13.59C14.65 13.5 14.49 13.46 14.32 13.71C14.16 13.96 13.69 14.51 13.55 14.67C13.4 14.84 13.26 14.86 13.01 14.73C12.76 14.61 11.96 14.35 11.01 13.5C10.27 12.84 9.77 12.03 9.63 11.78C9.48 11.53 9.61 11.4 9.74 11.27C9.85 11.16 9.99 10.98 10.11 10.84C10.24 10.7 10.28 10.59 10.36 10.43C10.45 10.26 10.4 10.12 10.34 9.99C10.28 9.87 9.78 8.65 9.58 8.15C9.38 7.67 9.18 7.73 9.03 7.73C8.89 7.72 8.72 7.72 8.56 7.72C8.39 7.72 8.13 7.78 7.9 8.03C7.67 8.28 7.03 8.88 7.03 10.1C7.03 11.32 7.92 12.5 8.04 12.66C8.17 12.83 9.78 15.31 12.25 16.38C12.84 16.63 13.3 16.78 13.66 16.89C14.25 17.08 14.79 17.05 15.22 16.99C15.7 16.92 16.69 16.39 16.9 15.81C17.11 15.23 17.11 14.73 17.04 14.63C16.98 14.51 16.82 14.45 16.57 14.39Z" />
  </svg>
);

const SendCredentialsModal = ({
  isOpen,
  onClose,
  initialUser = null, // { name, username, phone, password, org_id, org_name }
  isNewlyCreated = false,
  orgs = [],
  brandProfile = null
}) => {
  const { user } = useAuth();
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
      if (initialPass && initialPass !== '—') {
        setPassword(initialPass);
      } else {
        setPassword('223344');
      }
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

  // Determine dealer branding for credentials message
  const targetOrgId = initialUser?.org_id || initialUser?.orgId;
  const userOrg = orgs?.find(o => o.id === targetOrgId);
  let parentDealerOrg = null;
  if (userOrg && userOrg.parent_id && userOrg.parent_id !== 'a0000000-0000-0000-0000-000000000001') {
    parentDealerOrg = orgs?.find(o => o.id === userOrg.parent_id);
  }

  const isDealerContext = (user?.role === 'dealer') || 
                          (userOrg?.type === 'dealer') || 
                          !!parentDealerOrg || 
                          brandProfile?.is_dealer_customer || 
                          brandProfile?.org_type === 'dealer';

  const resolvedBrandName = isDealerContext
    ? (parentDealerOrg?.name || (userOrg?.type === 'dealer' ? userOrg.name : (user?.role === 'dealer' ? user.orgName : (brandProfile?.dealer_name || brandProfile?.brand_name || 'Dealer'))))
    : 'FuelTracks Technologies Pvt. Ltd.';

  const resolvedPortalUrl = (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('fueltracks.in'))
    ? window.location.origin
    : (isDealerContext ? (typeof window !== 'undefined' ? window.location.origin : 'https://app.fueltracks.in') : 'https://app.fueltracks.in');

  const resolvedSupportPhone = parentDealerOrg?.phone || 
                               (userOrg?.type === 'dealer' ? userOrg.phone : (user?.role === 'dealer' ? user.phone : (brandProfile?.support_phone || brandProfile?.dealer_phone)));

  const resolvedSupportEmail = parentDealerOrg?.email || 
                               (userOrg?.type === 'dealer' ? userOrg.email : (user?.role === 'dealer' ? user.email : (brandProfile?.support_email || brandProfile?.dealer_email)));

  if (!isOpen) return null;

  const normalizedDigits = normalizeWhatsAppPhone(phone);
  const previewMessage = formatWhatsAppCredentialsMessage({
    name,
    username,
    password,
    brandName: resolvedBrandName,
    portalUrl: resolvedPortalUrl,
    supportPhone: resolvedSupportPhone,
    supportEmail: resolvedSupportEmail
  });

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
      password,
      brandName: resolvedBrandName,
      portalUrl: resolvedPortalUrl,
      supportPhone: resolvedSupportPhone,
      supportEmail: resolvedSupportEmail
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
              <span>Password: <strong style={{ fontFamily: 'monospace', color: String(password).includes('privately') ? '#64748B' : '#059669' }}>{password || '223344'}</strong></span>
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

