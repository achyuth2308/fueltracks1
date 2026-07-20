import React, { useState, useEffect } from 'react';
import { formatLocalTime } from '../../../utils/dateUtils';
import { Loader2, History, ArrowRight, ShieldAlert, FileText, Search, Download } from 'lucide-react';
import * as api from '../api/profileApi';

const SectionHeader = ({ icon: Icon, title, description, extra, tint = 'bg-indigo-50', iconColor = 'text-indigo-600' }) => (
  <div className={`mb-5 pb-4 border-b border-[#E5E7EB] ${tint} -mx-[24px] px-[24px] -mt-[24px] pt-[24px] rounded-t-[14px] flex items-start justify-between`}>
    <div>
      <div className="flex items-center gap-3 mb-1">
        <div className={`p-2.5 bg-white rounded-xl shadow-sm flex items-center justify-center`}>
          <Icon className={`w-[22px] h-[22px] ${iconColor}`} />
        </div>
        <h3 className="text-[20px] font-semibold !text-black m-0">{title}</h3>
      </div>
      <p className="text-[14px] !text-black m-0 pl-[52px]">{description}</p>
    </div>
    {extra && <div className="mt-1">{extra}</div>}
  </div>
);

const AuditTab = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await api.getAuditHistory();
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
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-[20px] items-start w-full relative pb-[100px]">

      {/* Main Content Area (~68% of the remaining 80% page space) */}
      <div className="w-full lg:w-[68%]">
        <div className="bg-[#FFFFFF] p-[24px] pt-0 rounded-[14px] border border-[#E5E7EB] shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow">
          <SectionHeader
            icon={History}
            title="Profile Audit History"
            description="Track changes, security events, and administrative actions on your profile."
            extra={
              <button 
                onClick={() => alert("Downloading CSV...")}
                className="flex items-center text-[13px] font-semibold text-white bg-indigo-600 border border-indigo-600 px-3.5 py-2 rounded-[10px] hover:bg-indigo-700 hover:border-indigo-700 transition-all shadow-sm">
                <Download className="w-[16px] h-[16px] mr-1.5" /> Export
              </button>
            }
          />

          {error && <div className="p-4 bg-red-50 text-red-700 rounded-[10px] text-[14px] font-medium mb-4 border border-red-100 shadow-sm">{error}</div>}

          {loading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="w-[32px] h-[32px] text-indigo-600 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-[48px] bg-[#F9FAFB] rounded-[10px] border border-dashed border-[#E5E7EB] mt-[24px]">
              <Search className="w-[32px] h-[32px] text-[#9CA3AF] mx-auto mb-3" />
              <p className="text-[15px] font-bold !text-black m-0">No audit records found.</p>
              <p className="text-[14px] !text-black m-0 mt-1">Changes to your organization profile will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-[10px] border border-[#E5E7EB] shadow-sm mt-[24px]">
              <table className="min-w-full divide-y divide-[#E5E7EB]">
                <thead className="bg-[#F5F3FF]">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-[12px] font-bold !text-black uppercase tracking-wider">Date & Time</th>
                    <th className="px-5 py-3.5 text-left text-[12px] font-bold !text-black uppercase tracking-wider">Action</th>
                    <th className="px-5 py-3.5 text-left text-[12px] font-bold !text-black uppercase tracking-wider">User</th>
                    <th className="px-5 py-3.5 text-left text-[12px] font-bold !text-black uppercase tracking-wider">IP Address</th>
                    <th className="px-5 py-3.5 text-left text-[12px] font-bold !text-black uppercase tracking-wider">Changes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[#E5E7EB]">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap text-[13px] font-medium !text-black">
                        {formatLocalTime(log.created_at)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 inline-flex text-[12px] leading-4 font-bold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-[14px] font-bold !text-black">{log.performed_by_name}</div>
                        <div className="text-[13px] font-medium !text-black">{log.performed_by_email}</div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-[13px] font-medium !text-black">
                        {log.ip_address}
                      </td>
                      <td className="px-5 py-4 text-[13px] !text-black max-w-xs truncate">
                        {log.action === 'Profile Updated' && log.new_data && log.old_data && (
                          <div className="flex items-center cursor-help" title="Check old vs new state">
                            <span className="font-medium !text-black">Values modified</span>
                            <ArrowRight className="w-4 h-4 mx-1.5 text-[#9CA3AF]" />
                            <span className="!text-black font-bold">Saved</span>
                          </div>
                        )}
                        {log.action.includes('Logo') && <span className="font-medium !text-black">Image file updated</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right Information Panel (~32% of the remaining 80% page space) */}
      <div className="w-full lg:w-[32%] flex-shrink-0">
        <div className="bg-[#FFFFFF] p-[24px] rounded-[14px] border border-[#E5E7EB] shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow sticky top-[24px]">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-indigo-50 -mx-[24px] px-[24px] -mt-[24px] pt-[20px] bg-indigo-50 rounded-t-[14px]">
            <div className="p-1.5 bg-white rounded-lg shadow-sm border border-indigo-100">
              <ShieldAlert className="w-[18px] h-[18px] text-indigo-600" />
            </div>
            <h3 className="text-[16px] font-semibold !text-black m-0">Audit Compliance</h3>
          </div>

          <div className="space-y-4 mt-[16px]">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg mt-0.5 border border-indigo-100">
                <FileText className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h4 className="text-[14px] font-bold !text-black">Data Retention</h4>
                <p className="text-[13px] font-medium !text-black leading-relaxed mt-1">
                  Audit logs for organization settings are retained indefinitely for compliance and security review purposes.
                </p>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mt-2 shadow-sm">
              <h4 className="text-[14px] font-bold !text-[#163B63] mb-1">Suspicious Activity?</h4>
              <p className="text-[13px] font-medium text-blue-700 leading-relaxed m-0 mb-4">
                If you notice unauthorized changes, immediately change your password and contact support.
              </p>
              <button 
                onClick={() => alert("This would open the support ticket system.")}
                className="text-[13px] font-bold text-white bg-[#163B63] px-3 py-2 rounded-[10px] w-full hover:bg-blue-900 hover:shadow-md transform hover:-translate-y-0.5 transition-all shadow-sm">
                Report Issue
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default AuditTab;