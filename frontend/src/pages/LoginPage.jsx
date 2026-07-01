import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, ArrowRight, Loader2, AlertCircle, Lock, User, Users, EyeOff, Eye, ShieldCheck, Map, Activity, BarChart2, Server } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const DEMO_ACCOUNTS = [
  { label: 'Super Admin', email: 'admin@fueltracks.in', color: '#f97316' },
  { label: 'Dealer', email: 'dealer@abclogistics.com', color: '#f97316' },
  { label: 'Customer', email: 'customer@abcfleet.com', color: '#f97316' },
];

const LoginPage = () => {
  const { login, isAuthenticated, user, error: authError } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'customer') {
        navigate('/tracking', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) { setError('Please fill in both fields.'); return; }
    setLoading(true); setError(null);
    const result = await login(identifier, password);
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Authentication failed. Check your credentials.');
    }
  };

  const fillDemo = (acc) => {
    setEmail(acc.email);
    setPassword('password123');
    setError(null);
  };

  return (
    <div className="login-page min-h-screen flex items-start pt-[4vh] justify-center bg-gradient-to-br from-[#f0f9ff] via-white to-[#e0f2fe] font-sans px-6 pb-6 text-slate-800 relative overflow-hidden">

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center z-10">

        {/* Left Side */}
        <div className="hidden lg:flex flex-col space-y-8">
          <div className="flex flex-col justify-center h-full pt-10">
            {/* Logo */}
            <div className="flex flex-col items-start gap-4 mb-12">
              <div className="font-extrabold tracking-tight" style={{ color: '#000080', fontSize: '36px' }}>Welcome to</div>
              <img src="/logo_final_transparent.png" alt="FuelTracks" style={{ width: '380px', height: 'auto', objectFit: 'contain' }} />
            </div>

            {/* Premium Badge */}
            <div className="inline-flex items-center gap-2 mb-8">
              <span
                className="text-xs font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, rgba(249,115,22,0.12), rgba(124,77,255,0.12))',
                  border: '1px solid rgba(168,85,247,0.3)',
                  color: '#7C3AED',
                  backdropFilter: 'blur(8px)'
                }}
              >
                🔵 Live GPS &nbsp;•&nbsp; Telematics &nbsp;•&nbsp; Fleet Operations
              </span>
            </div>

            <h2
              className="text-2xl font-bold mb-6 leading-snug"
              style={{ color: '#1F2937', letterSpacing: '0.01em' }}
            >
              Real-Time Fleet Tracking &amp;<br />Telematics Platform
            </h2>
            <p
              className="max-w-md leading-relaxed text-lg"
              style={{ color: '#4B5563', lineHeight: '1.8' }}
            >
              Monitor your fleet in real-time, optimize operations, improve efficiency and drive your business forward.
            </p>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full max-w-md mx-auto mt-[5%] lg:ml-auto lg:mr-0">
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(249,115,22,0.18)] border-2 border-[#7dd3fc]">

            <div className="flex flex-col items-center mb-8 text-center">

              <h2 className="text-3xl text-gray-900 font-extrabold mb-2">Welcome Back!</h2>
              <p className="text-slate-900 text-sm">Sign in to access your fleet operations dashboard</p>
            </div>

            {(error || authError) && (
              <div className="flex items-center gap-2 p-3 mb-6 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                <AlertCircle size={16} />
                <span>{error || authError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Username / Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-800">
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter your username or email"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f97316] focus:border-transparent transition-all placeholder:text-slate-800 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-800">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f97316] focus:border-transparent transition-all placeholder:text-slate-800 text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-800 hover:text-slate-900"
                  >
                    {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-[#f97316] focus:ring-[#f97316] accent-[#f97316]" />
                  <span className="text-sm font-medium text-slate-900">Remember Me</span>
                </label>
                <a href="#" className="text-sm font-semibold text-[#f97316] hover:text-[#7ea0b6]">Forgot Password?</a>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:opacity-90"
                style={{
                  background: 'linear-gradient(90deg, #64748b 0%, #475569 40%, #334155 80%, #1e293b 100%)',
                  boxShadow: '0 4px 14px rgba(249,115,22,0.35), 0 4px 14px rgba(124,77,255,0.2)'
                }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <><ArrowRight size={18} /> LOGIN</>}
              </button>
            </form>

            <div className="mt-8 bg-[#f0f9ff]/60 border border-[#e0f2fe] rounded-xl p-4 flex items-center justify-center gap-3">
              <div className="text-[#f97316] bg-white p-2 rounded-lg shadow-sm border border-[#e0f2fe]">
                <Users size={20} />
              </div>
              <p className="text-sm text-slate-700 font-medium">
                Access is automatically determined based on your account permissions.
              </p>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
