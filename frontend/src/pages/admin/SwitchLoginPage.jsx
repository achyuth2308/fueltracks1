import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { impersonateUser } from '../../api/adminApi';

const SwitchLoginPage = () => {
  const { userId } = useParams();
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const executeSwitch = async () => {
      try {
        const adminToken = localStorage.getItem('token') || sessionStorage.getItem('adminToken');
        if (!adminToken) {
          if (isMounted) setError('No administrator session found. Please log in first.');
          return;
        }

        const response = await impersonateUser(userId);
        if (response?.success && response?.data?.accessToken) {
          const customerToken = response.data.accessToken;

          // Store customer token in sessionStorage so it stays ISOLATED to this new browser tab
          sessionStorage.setItem('token', customerToken);
          sessionStorage.setItem('adminToken', adminToken);
          sessionStorage.setItem('isSwitchedSession', 'true');

          if (response.data.user?.orgName) {
            sessionStorage.setItem('activeOrgName', response.data.user.orgName);
          }

          // Open the customer dashboard in this tab
          window.location.replace('/dashboard');
        } else {
          let msg = response?.error || 'Failed to switch user session';
          if (typeof msg === 'object') msg = msg.message || JSON.stringify(msg);
          if (isMounted) setError(msg);
        }
      } catch (err) {
        let msg = err.response?.data?.error || err.message || 'Error occurred while switching session';
        if (typeof msg === 'object') msg = msg.message || JSON.stringify(msg);
        if (isMounted) setError(msg);
      }
    };

    if (userId) {
      executeSwitch();
    } else {
      setError('No target user specified.');
    }

    return () => { isMounted = false; };
  }, [userId]);

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#EEF5F8',
        padding: '20px',
        boxSizing: 'border-box'
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #fecaca',
          boxShadow: '0 8px 24px rgba(239, 68, 68, 0.08)',
          padding: '28px 32px',
          maxWidth: '460px',
          width: '100%',
          textAlign: 'center'
        }}>
          <AlertTriangle size={36} color="#ef4444" style={{ margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
            Switch Login Failed
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0', lineHeight: 1.5 }}>
            {error}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={() => window.close()}
              style={{
                padding: '8px 18px',
                borderRadius: '6px',
                background: '#f1f5f9',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 600,
                border: '1px solid #cbd5e1',
                cursor: 'pointer'
              }}
            >
              Close Tab
            </button>
            <button
              onClick={() => window.location.replace('/admin/users')}
              style={{
                padding: '8px 18px',
                borderRadius: '6px',
                background: '#f97316',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(249, 115, 22, 0.3)'
              }}
            >
              Back to Users
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#EEF5F8',
      gap: '14px'
    }}>
      <div style={{ position: 'relative', width: '48px', height: '48px' }}>
        <Loader2 size={48} className="animate-spin" color="#f97316" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
          Switching User Session...
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
          Opening customer telematics dashboard in this tab
        </div>
      </div>
    </div>
  );
};

export default SwitchLoginPage;

