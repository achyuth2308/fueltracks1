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
          <div>
            {/* Logo */}
            <div className="flex flex-col items-start gap-2 mb-5">
              <div className="text-xl font-medium text-slate-500 mb-2">Welcome to</div>
              <img src="/logo_transparent.png" alt="FuelTracks" style={{ height: '50px', width: 'auto', objectFit: 'contain' }} />
            </div>

            {/* Premium Badge */}
            <div className="inline-flex items-center gap-2 mb-6">
              <span
                className="text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1.5 rounded-full"
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
              className="text-lg font-bold mb-4 leading-snug"
              style={{ color: '#1F2937', letterSpacing: '0.01em' }}
            >
              Real-Time Fleet Tracking &amp;<br />Telematics Platform
            </h2>
            <p
              className="max-w-md leading-relaxed"
              style={{ color: '#4B5563', fontSize: '15px', lineHeight: '1.75' }}
            >
              Monitor your fleet in real-time, optimize operations, improve efficiency and drive your business forward.
            </p>
          </div>

          {/* Map Graphic Section */}
          <div className="relative w-full mt-4 bg-transparent opacity-80">
            {/* World Map — cool dusty blue and biscuit tint */}
            <img
              src="/world.svg"
              alt="World Map"
              className="w-full h-auto block"
              style={{
                opacity: 0.55,
                filter: 'contrast(1.2) brightness(0.9) sepia(1) saturate(3) hue-rotate(180deg)'
              }}
            />

            {/* Overlay container */}
            <div className="absolute inset-0">

              {/* Static route lines connecting nodes */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M 23 32 Q 35 10 50 22" fill="none" stroke="#f97316" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.7" vectorEffect="non-scaling-stroke" />
                <path d="M 50 22 Q 58 15 65 40" fill="none" stroke="#f97316" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.7" vectorEffect="non-scaling-stroke" />
                <path d="M 65 40 Q 75 55 80 72" fill="none" stroke="#f97316" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.7" vectorEffect="non-scaling-stroke" />
              </svg>

              {/* North America (USA) */}
              <div className="absolute" style={{ top: '32%', left: '23%', transform: 'translate(-50%, -50%)' }}>
                <div className="relative w-3 h-3 bg-[#f97316] rounded-full shadow-lg">
                  <div className="absolute inset-0 bg-[#0ea5e9] rounded-full animate-ping opacity-60"></div>
                </div>
              </div>
              <div className="absolute bg-[#f97316] text-white p-1 rounded-full shadow-md" style={{ top: '32%', left: '23%', transform: 'translate(-50%, -170%)' }}>
                <Truck size={10} />
              </div>

              {/* Europe */}
              <div className="absolute" style={{ top: '22%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                <div className="relative w-3 h-3 bg-[#f97316] rounded-full shadow-lg">
                  <div className="absolute inset-0 bg-[#0ea5e9] rounded-full animate-ping opacity-60"></div>
                </div>
              </div>
              <div className="absolute bg-[#f97316] text-white p-1 rounded-full shadow-md" style={{ top: '22%', left: '50%', transform: 'translate(-50%, -170%)' }}>
                <Truck size={10} />
              </div>

              {/* India */}
              <div className="absolute" style={{ top: '40%', left: '65%', transform: 'translate(-50%, -50%)' }}>
                <div className="relative w-3 h-3 bg-[#f97316] rounded-full shadow-lg">
                  <div className="absolute inset-0 bg-[#0ea5e9] rounded-full animate-ping opacity-60"></div>
                </div>
              </div>
              <div className="absolute bg-[#f97316] text-white p-1 rounded-full shadow-md" style={{ top: '40%', left: '65%', transform: 'translate(-50%, -170%)' }}>
                <Truck size={10} />
              </div>

              {/* Australia */}
              <div className="absolute" style={{ top: '72%', left: '80%', transform: 'translate(-50%, -50%)' }}>
                <div className="relative w-3 h-3 bg-[#f97316] rounded-full shadow-lg">
                  <div className="absolute inset-0 bg-[#0ea5e9] rounded-full animate-ping opacity-60"></div>
                </div>
              </div>
              <div className="absolute bg-[#f97316] text-white p-1 rounded-full shadow-md" style={{ top: '72%', left: '80%', transform: 'translate(-50%, -170%)' }}>
                <Truck size={10} />
              </div>
            </div>
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
