import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Truck, ArrowRight, Loader2, AlertCircle, Lock, User, Users, EyeOff, Eye, Car, Package, Clock, Gauge, Activity, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
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

  return (
    <div className="login-page min-h-screen lg:h-screen flex items-center justify-center bg-white font-sans px-4 sm:px-6 lg:px-8 py-6 lg:py-0 text-slate-800 relative overflow-y-auto lg:overflow-hidden">

      {/* Subtle Background Decorative Elements - Very Faint Soft Glows */}
      <div className="absolute -top-28 -left-20 w-[40rem] h-[40rem] bg-sky-100/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/4 w-[45rem] h-[45rem] bg-indigo-50/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-[35rem] h-[35rem] bg-slate-100/50 rounded-full blur-3xl pointer-events-none" />

      {/* Decorative SVG curves & diagonal accent lines with subtle dots */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none fill-none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M -30 220 Q 380 270 760 680"
          stroke="#cbd5e1"
          strokeWidth="1.2"
          strokeDasharray="4 6"
          opacity="0.45"
        />
        <line
          x1="220"
          y1="520"
          x2="720"
          y2="280"
          stroke="#cbd5e1"
          strokeWidth="1"
          opacity="0.35"
        />

        <ellipse cx="60" cy="225" rx="14" ry="7" className="fill-slate-100/60 stroke-slate-300/60" strokeWidth="1" />
        <ellipse cx="360" cy="272" rx="12" ry="6" className="fill-slate-100/60 stroke-slate-300/60" strokeWidth="1" />
        <ellipse cx="620" cy="460" rx="15" ry="7.5" className="fill-slate-100/60 stroke-slate-300/60" strokeWidth="1" />

        <circle cx="100" cy="720" r="320" stroke="#cbd5e1" strokeWidth="1" opacity="0.2" />
        <circle cx="100" cy="720" r="440" stroke="#cbd5e1" strokeWidth="1" opacity="0.12" />
      </svg>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center z-10 py-2 lg:py-0">

        {/* Left Side - Clean White Aesthetic with Simple Animations */}
        <div className="hidden lg:flex lg:col-span-7 flex-col justify-center py-2 pr-4 relative">

          {/* Top-Left Logo with Premium WELCOME TO Badge */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="flex flex-col items-start gap-2 pt-1 mb-4 xl:mb-5"
          >
            <span className="text-xs sm:text-sm font-black italic uppercase tracking-[0.25em] bg-gradient-to-r from-pink-500 via-indigo-500 to-sky-500 bg-clip-text text-transparent drop-shadow-2xs">
              WELCOME TO
            </span>
            <img
              src="/logo_vertical.png"
              alt="FuelTracks"
              style={{ width: '190px', height: 'auto', objectFit: 'contain' }}
              className="drop-shadow-xs transition-transform duration-300 my-1"
            />
          </motion.div>

          {/* Center Content Section */}
          <div className="my-2">
            {/* LIVE GPS • TELEMATICS • FLEET OPERATIONS Pill Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
              className="inline-flex items-center gap-2 mb-3.5"
            >
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[0.16em] px-3.5 py-1.5 rounded-full bg-gradient-to-r from-sky-50/90 via-emerald-50/80 to-indigo-50/90 border border-slate-200/80 shadow-2xs backdrop-blur-md flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse"></span>
                <span className="text-sky-700">LIVE GPS</span>
                <span className="text-slate-400 font-normal">&bull;</span>
                <span className="text-emerald-700">TELEMATICS</span>
                <span className="text-slate-400 font-normal">&bull;</span>
                <span className="text-indigo-700">FLEET OPERATIONS</span>
              </span>
            </motion.div>

            {/* Bold Heading (2 lines with brand blue accent) */}
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
              className="text-2xl lg:text-3xl xl:text-4xl font-[850] text-[#1b3644] tracking-tight leading-[1.18] mb-3.5"
            >
              Real-Time Fleet Tracking &amp;<br />
              <span className="bg-gradient-to-r from-[#0284c7] via-[#00A3E0] to-[#0369a1] bg-clip-text text-transparent">
                Telematics Platform
              </span>
            </motion.h1>

            {/* Medium Readable Subtext */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
              className="text-slate-600 text-sm lg:text-base leading-relaxed max-w-lg mb-6 font-normal"
            >
              Monitor your fleet in real-time, optimize operations, improve efficiency and drive your business forward.
            </motion.p>

            {/* Stat Cards Row - Compact, Lightweight, Colorful Icons */}
            <div className="grid grid-cols-3 gap-3 max-w-md">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4, ease: 'easeOut' }}
                className="bg-gradient-to-br from-sky-50 to-sky-100/70 hover:from-sky-100 hover:to-sky-200/60 rounded-xl p-3 shadow-sm border border-sky-200/60 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-sky-900/10 hover:border-sky-300"
              >
                <div className="w-6.5 h-6.5 rounded-lg bg-white/70 text-sky-600 flex items-center justify-center mb-2 border border-sky-100">
                  <Truck className="w-3.5 h-3.5 stroke-[2.2]" />
                </div>
                <div className="text-lg sm:text-xl font-extrabold text-[#1b3644] tracking-tight mb-0.5 leading-none">
                  247
                </div>
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
                  Active Vehicles
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.48, ease: 'easeOut' }}
                className="bg-gradient-to-br from-emerald-50 to-emerald-100/70 hover:from-emerald-100 hover:to-emerald-200/60 rounded-xl p-3 shadow-sm border border-emerald-200/60 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-emerald-900/10 hover:border-emerald-300"
              >
                <div className="w-6.5 h-6.5 rounded-lg bg-white/70 text-emerald-600 flex items-center justify-center mb-2 border border-emerald-100">
                  <Clock className="w-3.5 h-3.5 stroke-[2.2]" />
                </div>
                <div className="text-lg sm:text-xl font-extrabold text-[#1b3644] tracking-tight mb-0.5 leading-none">
                  94.2%
                </div>
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
                  Fleet Uptime
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.56, ease: 'easeOut' }}
                className="bg-gradient-to-br from-violet-50 to-violet-100/70 hover:from-violet-100 hover:to-violet-200/60 rounded-xl p-3 shadow-sm border border-violet-200/60 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-violet-900/10 hover:border-violet-300"
              >
                <div className="w-6.5 h-6.5 rounded-lg bg-white/70 text-violet-600 flex items-center justify-center mb-2 border border-violet-100">
                  <Gauge className="w-3.5 h-3.5 stroke-[2.2]" />
                </div>
                <div className="text-lg sm:text-xl font-extrabold text-[#1b3644] tracking-tight mb-0.5 leading-none whitespace-nowrap">
                  18.4 <span className="text-xs font-bold text-slate-500">km/L</span>
                </div>
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
                  Avg Efficiency
                </div>
              </motion.div>
            </div>
          </div>

          {/* Bottom-Right Floating Icon Cards - Colorful Icons */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.65, ease: 'easeOut' }}
            className="flex justify-end items-center gap-2.5 pt-3"
          >
            <div className="w-[68px] py-2.5 bg-gradient-to-br from-orange-50 to-orange-100/70 hover:from-orange-100 hover:to-orange-200/60 rounded-xl shadow-sm border border-orange-200/60 flex flex-col items-center justify-center gap-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-orange-900/10 hover:border-orange-300">
              <div className="w-7 h-7 rounded-lg bg-white/70 text-orange-600 flex items-center justify-center border border-orange-100">
                <Truck className="w-3.5 h-3.5 stroke-[2.2]" />
              </div>
              <span className="text-[9.5px] font-bold text-slate-700">Freight</span>
            </div>

            <div className="w-[68px] py-2.5 bg-gradient-to-br from-cyan-50 to-cyan-100/70 hover:from-cyan-100 hover:to-cyan-200/60 rounded-xl shadow-sm border border-cyan-200/60 flex flex-col items-center justify-center gap-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-cyan-900/10 hover:border-cyan-300">
              <div className="w-7 h-7 rounded-lg bg-white/70 text-cyan-600 flex items-center justify-center border border-cyan-100">
                <Package className="w-3.5 h-3.5 stroke-[2.2]" />
              </div>
              <span className="text-[9.5px] font-bold text-slate-700">Delivery</span>
            </div>

            <div className="w-[68px] py-2.5 bg-gradient-to-br from-indigo-50 to-indigo-100/70 hover:from-indigo-100 hover:to-indigo-200/60 rounded-xl shadow-sm border border-indigo-200/60 flex flex-col items-center justify-center gap-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-900/10 hover:border-indigo-300">
              <div className="w-7 h-7 rounded-lg bg-white/70 text-indigo-600 flex items-center justify-center border border-indigo-100">
                <Car className="w-3.5 h-3.5 stroke-[2.2]" />
              </div>
              <span className="text-[9.5px] font-bold text-slate-700">Fleet</span>
            </div>
          </motion.div>

        </div>

        {/* Right Side - Login Form with Animated Flowing Gradient Border */}
        <div className="w-full lg:col-span-5 max-w-md mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="relative p-[2.5px] rounded-2xl group transition-all duration-300"
          >
            {/* Soft Outer Ambient Glow */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-pink-300 via-sky-300 to-white blur-xs opacity-45 group-hover:opacity-70 transition-opacity duration-500 animate-pulse pointer-events-none" />

            {/* Continuously Rotating Pink, Blue & White Light-Glow Gradient Border */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
              <div
                className="absolute -inset-[150%] opacity-90"
                style={{
                  background: 'conic-gradient(from 0deg at 50% 50%, #f472b6 0deg, #ffffff 60deg, #38bdf8 120deg, #ec4899 180deg, #ffffff 240deg, #0284c7 300deg, #f472b6 360deg)',
                  animation: 'spin 14s linear infinite',
                }}
              />
            </div>

            {/* Inner Card Content */}
            <div className="bg-white rounded-[13.5px] p-5 sm:p-7 relative z-10 shadow-[0_20px_50px_rgba(249,115,22,0.14)] transition-shadow duration-300">

              {/* Mobile Logo View if on small screen */}
              <div className="flex lg:hidden flex-col items-center gap-1 mb-4">
                <img
                  src="/logo_vertical.png"
                  alt="FuelTracks"
                  style={{ width: '160px', height: 'auto', objectFit: 'contain' }}
                />
              </div>

              <div className="flex flex-col items-center mb-6 text-center">
                <h2 className="text-2xl sm:text-3xl text-gray-900 font-extrabold mb-1.5">Welcome Back!</h2>
                <p className="text-slate-900 text-xs sm:text-sm">Sign in to access your fleet operations dashboard</p>
              </div>

              {(error || authError) && (
                <div className="flex items-center gap-2 p-3 mb-5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error || authError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-4.5">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Username / Email</label>
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
                      className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f97316]/50 focus:border-[#f97316] focus:shadow-[0_0_12px_rgba(249,115,22,0.15)] transition-all duration-200 ease-out placeholder:text-slate-800 text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Password</label>
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
                      className="w-full pl-10 pr-10 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f97316]/50 focus:border-[#f97316] focus:shadow-[0_0_12px_rgba(249,115,22,0.15)] transition-all duration-200 ease-out placeholder:text-slate-800 text-slate-900"
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

                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-[#f97316] focus:ring-[#f97316] accent-[#f97316]" />
                    <span className="text-xs sm:text-sm font-medium text-slate-900">Remember Me</span>
                  </label>
                  <Link to="/forgot-password" className="text-xs sm:text-sm font-semibold text-[#f97316] hover:text-[#7ea0b6]">Forgot Password?</Link>
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="w-full flex items-center justify-center gap-2 py-3 sm:py-3.5 text-white rounded-xl font-bold text-sm transition-shadow disabled:opacity-70 disabled:cursor-not-allowed hover:shadow-lg cursor-pointer mt-1"
                  style={{
                    background: 'linear-gradient(90deg, #64748b 0%, #475569 40%, #334155 80%, #1e293b 100%)',
                    boxShadow: '0 4px 14px rgba(249,115,22,0.35), 0 4px 14px rgba(124,77,255,0.2)'
                  }}
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <><ArrowRight size={18} /> LOGIN</>}
                </motion.button>
              </form>

              <div className="mt-6 sm:mt-7 bg-[#f0f9ff]/60 border border-[#e0f2fe] rounded-xl p-3.5 flex items-center justify-center gap-3">
                <div className="text-[#f97316] bg-white p-1.5 sm:p-2 rounded-lg shadow-sm border border-[#e0f2fe] shrink-0">
                  <Users size={18} />
                </div>
                <p className="text-xs sm:text-sm text-slate-700 font-medium leading-tight">
                  Access is automatically determined based on your account permissions.
                </p>
              </div>

            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
