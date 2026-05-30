import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, ArrowRight, Loader2, AlertCircle, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const DEMO_ACCOUNTS = [
  { label: 'Super Admin', email: 'admin@fueltracks.in', color: '#60a5fa' },
  { label: 'Dealer', email: 'dealer@abclogistics.com', color: '#34d399' },
  { label: 'Customer', email: 'customer@abcfleet.com', color: '#a78bfa' },
];

const LoginPage = () => {
  const { login, isAuthenticated, error: authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [focusedField, setFocusedField] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in both fields.'); return; }
    setLoading(true); setError(null);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) navigate('/dashboard', { replace: true });
    else setError(result.error || 'Authentication failed. Check your credentials.');
  };

  const fillDemo = (acc) => {
    setEmail(acc.email);
    setPassword('password123');
    setError(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse 80% 60% at 20% 20%, rgba(37,99,235,0.07) 0%, transparent 55%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(99,102,241,0.05) 0%, transparent 55%), #0a0f1e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* Grid background */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '400px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '52px', height: '52px', margin: '0 auto 14px',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(37,99,235,0.4), 0 0 0 1px rgba(37,99,235,0.3)',
          }}>
            <Truck size={24} color="white" />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.03em', margin: 0 }}>
            FuelTracks
          </h1>
          <p style={{ fontSize: '12px', color: '#4a5568', marginTop: '4px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Enterprise Fleet Intelligence
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'linear-gradient(160deg, #0f1729 0%, #0c1422 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset',
        }}>
          <div style={{ marginBottom: '22px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
              Sign in to your account
            </h2>
            <p style={{ fontSize: '12px', color: '#4a5568' }}>
              Access your fleet management dashboard
            </p>
          </div>

          {/* Error */}
          {(error || authError) && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 12px', marginBottom: '16px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '8px',
              animation: 'slide-in-up 0.2s ease',
            }}>
              <AlertCircle size={14} color="#f87171" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: '#f87171', fontWeight: 500 }}>
                {error || authError}
              </span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#4a5568', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                placeholder="name@company.com"
                style={{
                  width: '100%', padding: '10px 12px',
                  background: 'rgba(0,0,0,0.4)',
                  border: `1px solid ${focusedField === 'email' ? '#2563eb' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: '8px', color: '#e2e8f0', fontSize: '13px',
                  fontFamily: 'Inter, sans-serif', outline: 'none',
                  boxShadow: focusedField === 'email' ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none',
                  transition: 'all 0.15s ease', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: '#4a5568', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                <span>Password</span>
                <span style={{ color: '#2563eb', cursor: 'pointer', textTransform: 'none', letterSpacing: 'normal', fontWeight: 500 }}>Forgot?</span>
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '10px 12px',
                  background: 'rgba(0,0,0,0.4)',
                  border: `1px solid ${focusedField === 'password' ? '#2563eb' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: '8px', color: '#e2e8f0', fontSize: '13px',
                  fontFamily: 'Inter, sans-serif', outline: 'none',
                  boxShadow: focusedField === 'password' ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none',
                  transition: 'all 0.15s ease', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                width: '100%', padding: '11px',
                background: loading ? 'rgba(37,99,235,0.4)' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                border: '1px solid rgba(37,99,235,0.4)',
                borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 16px rgba(37,99,235,0.35)',
                transition: 'all 0.2s ease', marginTop: '4px',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {loading ? (
                <><Loader2 size={15} style={{ animation: 'spin 0.75s linear infinite' }} /> Authenticating...</>
              ) : (
                <><span>Sign In</span><ArrowRight size={15} /></>
              )}
            </button>
          </form>
        </div>

        {/* Demo accounts */}
        <div style={{
          marginTop: '16px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '12px',
          padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <Zap size={11} color="#4a5568" />
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#2d3748', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Quick Demo Access
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {DEMO_ACCOUNTS.map(acc => (
              <button
                key={acc.email}
                onClick={() => fillDemo(acc)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 10px', borderRadius: '6px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer', transition: 'all 0.15s',
                  fontFamily: 'Inter, sans-serif',
                  width: '100%',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: acc.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: acc.color }}>{acc.label}</span>
                  <span style={{ fontSize: '11px', color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}>{acc.email}</span>
                </div>
                <span style={{ fontSize: '10px', color: '#2d3748', fontFamily: 'JetBrains Mono, monospace' }}>password123</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
