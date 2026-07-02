import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader2, AlertCircle, Mail, CheckCircle } from 'lucide-react';
import axiosInstance from '../api/axios';


const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) { setError('Please enter your email.'); return; }
    setLoading(true); setError(null);
    
    try {
      const { data } = await axiosInstance.post('/api/auth/forgot-password', { email });
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to send request');
      }
      
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
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
            <h2 className="text-3xl text-gray-900 font-extrabold mb-2">Forgot Password</h2>
            <p className="text-slate-900 text-sm">Enter your email to receive a reset link</p>
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
              <p className="text-slate-700 font-medium">If an account exists for <b>{email}</b>, an email has been sent with further instructions.</p>
              <Link to="/login" className="mt-4 text-[#f97316] font-semibold hover:underline flex items-center gap-2">
                <ArrowLeft size={16} /> Back to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-800">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f97316] focus:border-transparent transition-all placeholder:text-slate-800 text-slate-900"
                  />
                </div>
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
                {loading ? <Loader2 size={18} className="animate-spin" /> : <><ArrowRight size={18} /> SEND RESET LINK</>}
              </button>

              <div className="text-center mt-6">
                <Link to="/login" className="text-sm font-semibold text-slate-500 hover:text-[#f97316] transition-colors flex items-center justify-center gap-1">
                  <ArrowLeft size={16} /> Back to Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
