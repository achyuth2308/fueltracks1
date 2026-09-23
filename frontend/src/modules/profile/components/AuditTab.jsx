import React, { useState, useEffect } from 'react';
import { formatLocalTime } from '../../../utils/dateUtils';
import { Loader2, History, ArrowRight, ShieldAlert, FileText, Search, Download, ShieldCheck } from 'lucide-react';
import * as api from '../api/profileApi';

const SectionHeader = ({ icon: Icon, title, description, extra }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-100">
    <div className="flex items-center gap-3.5">
      <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-xs">
        <Icon className="w-5 h-5 stroke-[2.2]" />
      </div>
      <div>
        <h3 className="text-base font-black uppercase tracking-wide m-0" style={{ color: '#0F172A' }}>{title}</h3>
        <p className="text-xs text-slate-600 font-semibold m-0 mt-0.5">{description}</p>
      </div>
    </div>
    {extra && <div>{extra}</div>}
  </div>
);

const AuditTab = ({ orgId = null }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const res = await api.getAuditHistory(orgId);
        if (res.success) {
          setLogs(res.data || []);
        }
      } catch (err) {
        setError(err.response?.data?.error || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [orgId]);

  const handleExportCSV = () => {
    if (!logs || logs.length === 0) return;
    const headers = ['Date & Time', 'Action', 'User Name', 'User Email', 'IP Address', 'Details'];
    const rows = logs.map(log => [
      `"${formatLocalTime(log.created_at)}"`,
      `"${(log.action || '').replace(/"/g, '""')}"`,
      `"${(log.performed_by_name || '').replace(/"/g, '""')}"`,
      `"${(log.performed_by_email || '').replace(/"/g, '""')}"`,
      `"${(log.ip_address || '').replace(/"/g, '""')}"`,
      `"${log.action === 'Profile Updated' ? 'Values modified' : (log.action || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `audit_trail_${orgId || 'org'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col xl:flex-row gap-8 items-start w-full relative pb-28">
      {/* Main Content Area */}
      <div className="w-full xl:w-[65%] flex flex-col gap-6">
        <div className="bg-white p-7 rounded-3xl border border-slate-200/90 shadow-sm">
          <SectionHeader
            icon={History}
            title="Profile Audit History"
            description="Track changes, security events, and administrative actions on this organization profile."
            extra={
              <button 
                onClick={handleExportCSV}
                disabled={logs.length === 0}
                className="flex items-center text-xs font-extrabold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 px-4 py-2.5 rounded-xl transition-all shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                <Download className="w-4 h-4 mr-1.5 text-slate-500" /> Export CSV
              </button>
            }
          />

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-2xl text-xs font-semibold mb-4 border border-red-200 shadow-xs flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col justify-center items-center py-20">
              <Loader2 className="w-8 h-8 text-slate-700 animate-spin mb-3" />
              <span className="text-xs font-bold text-slate-500">Loading audit history...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <Search className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-800 m-0">No audit records found.</p>
              <p className="text-[11px] text-slate-500 m-0 mt-0.5">Profile and settings modifications will be recorded here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-[11px] font-black text-slate-700 uppercase tracking-wider">Date & Time</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-black text-slate-700 uppercase tracking-wider">Action</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-black text-slate-700 uppercase tracking-wider">User</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-black text-slate-700 uppercase tracking-wider">IP Address</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-black text-slate-700 uppercase tracking-wider">Changes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors text-xs">
                      <td className="px-5 py-4 whitespace-nowrap font-medium text-slate-800">
                        {formatLocalTime(log.created_at)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 inline-flex text-[11px] font-extrabold rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{log.performed_by_name}</div>
                        <div className="text-[11px] text-slate-500">{log.performed_by_email}</div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap font-mono text-[11px] text-slate-600">
                        {log.ip_address}
                      </td>
                      <td className="px-5 py-4 text-slate-700 max-w-xs truncate">
                        {log.action === 'Profile Updated' && log.new_data && log.old_data && (
                          <div className="flex items-center cursor-help" title="Check old vs new state">
                            <span className="font-semibold text-slate-800">Values modified</span>
                            <ArrowRight className="w-3.5 h-3.5 mx-1.5 text-slate-400" />
                            <span className="text-slate-900 font-bold">Saved</span>
                          </div>
                        )}
                        {log.action.includes('Logo') && <span className="font-semibold text-slate-800">Image file updated</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right Information Panel */}
      <div className="w-full xl:w-[35%] flex flex-col gap-6 sticky top-8">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-lg">
          <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
            <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-xs">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-extrabold text-slate-900 m-0" style={{ color: '#0F172A' }}>Audit Compliance</h4>
          </div>

          <div className="space-y-4 text-xs font-medium">
            <div className="flex items-start gap-3.5 pb-4 border-b border-slate-100">
              <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl">
                <FileText className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-wide m-0">Data Retention</h5>
                <p className="text-xs text-slate-600 leading-relaxed mt-1 m-0">
                  Audit logs for organization settings and credentials are permanently retained for regulatory compliance and security review.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl">
              <div className="flex items-center gap-2 mb-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h5 className="text-xs font-black text-slate-900 m-0">Security Assurance</h5>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed m-0">
                Every login session, password change, and profile configuration write is recorded with user identity and origin IP address.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditTab;