import React, { useState, useEffect } from 'react';
import { Loader2, History, ArrowRight } from 'lucide-react';
import * as api from '../api/profileApi';

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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48 bg-white rounded-lg shadow-sm">
        <Loader2 className="w-8 h-8 text-[#f97316] animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>;
  }

  return (
    <div className="bg-white p-6 sm:p-10 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200">
      <div className="flex items-center mb-6 border-b pb-4">
        <History className="w-5 h-5 text-[#112d4e] mr-2" />
        <h3 className="text-xl font-extrabold text-[#0a2540] tracking-tight">Profile Audit History</h3>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-8 text-[#112d4e]">
          No audit records found for profile changes.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#112d4e] uppercase tracking-wider">Date & Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#112d4e] uppercase tracking-wider">Action</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#112d4e] uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#112d4e] uppercase tracking-wider">IP Address</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#112d4e] uppercase tracking-wider">Changes</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-white">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#112d4e]">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-[#e0f2fe] text-[#5d7389]">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#112d4e]">
                    {log.performed_by_name} <br/>
                    <span className="text-xs text-[#112d4e]">{log.performed_by_email}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#112d4e]">
                    {log.ip_address}
                  </td>
                  <td className="px-6 py-4 text-sm text-[#112d4e] max-w-xs truncate">
                    {log.action === 'Profile Updated' && log.new_data && log.old_data && (
                      <div className="flex items-center cursor-help" title="Check old vs new state">
                        <span className="text-[#112d4e]">Values modified</span>
                        <ArrowRight className="w-3 h-3 mx-1 text-[#112d4e]" />
                        <span className="text-green-600">Saved</span>
                      </div>
                    )}
                    {log.action.includes('Logo') && 'Image file updated'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AuditTab;
