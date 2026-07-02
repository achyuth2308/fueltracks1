import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader2, AlertCircle, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import axiosInstance from '../api/axios';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || !confirmPassword) { setError('Please fill in both fields.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    
    setLoading(true); setError(null);
    
    try {
      const { data } = await axiosInstance.post('/api/auth/reset-password', { token, newPassword: password });
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to reset password');
      }
      
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page min-h-screen flex items-start pt-[10vh] justify-center bg-gradient-to-br from-[#f0f9ff] via-white to-[#e0f2fe] font-sans px-6 pb-6 text-slate-800">
      <div className="w-full max-w-md mx-auto relative z-10">

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/logo_final_transparent.png" alt="FuelTracks" style={{ width: '220px', height: 'auto', objectFit: 'contain' }} />
        </div>


        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(249,115,22,0.18)] border-2 border-[#7dd3fc]">
          <div className="flex flex-col items-center mb-8 text-center">
            <h2 className="text-3xl text-gray-900 font-extrabold mb-2">Reset Password</h2>
            <p className="text-slate-900 text-sm">Create a new secure password for your account</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-6 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-500 mb-2">
                <CheckCircle size={32} />
              </div>
              <p className="text-slate-700 font-medium">Your password has been successfully reset!</p>
              <p className="text-sm text-slate-500">Redirecting to login...</p>
              <Link to="/login" className="mt-4 text-[#f97316] font-semibold hover:underline flex items-center gap-2">
                <ArrowRight size={16} /> Go to Login now
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-800">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
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

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Confirm Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-800">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f97316] focus:border-transparent transition-all placeholder:text-slate-800 text-slate-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !token}
                className="w-full flex items-center justify-center gap-2 py-3.5 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:opacity-90"
                style={{
                  background: 'linear-gradient(90deg, #64748b 0%, #475569 40%, #334155 80%, #1e293b 100%)',
                  boxShadow: '0 4px 14px rgba(249,115,22,0.35), 0 4px 14px rgba(124,77,255,0.2)'
                }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle size={18} /> RESET PASSWORD</>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
