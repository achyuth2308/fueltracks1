import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  ArrowLeft, Save, Plus, Trash2, CheckCircle2, AlertCircle,
  Clock, ShieldCheck, RefreshCw, Smartphone, Check, X, Send
} from 'lucide-react';
import {
  getRecipients, createRecipient, updateRecipient, deleteRecipient,
  getWhatsAppSettings, updateWhatsAppSettings,
  getWhatsAppMessages, retryWhatsAppMessage
} from '../../api/whatsappApi';

const WhatsAppSettingsPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('recipients'); // 'recipients' | 'settings' | 'logs'
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Settings State
  const [settings, setSettings] = useState({
    daily_report_enabled: true,
    daily_report_time: '07:00',
    daily_report_include_pdf: false
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Recipients State
  const [recipients, setRecipients] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRecipient, setNewRecipient] = useState({
    name: '',
    phone: '',
    role: 'owner',
    optIn: true,
    consentConfirmed: false,
    receiveRefill: true,
    receiveTheft: true,
    receiveDailyReport: true
  });
  const [submittingRecipient, setSubmittingRecipient] = useState(false);

  // Logs State
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  const [logFilterStatus, setLogFilterStatus] = useState('');
  const [logFilterEvent, setLogFilterEvent] = useState('');

  useEffect(() => {
    loadSettings();
    loadRecipients();
    loadLogs(1);
  }, []);

  const showNotification = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadSettings = async () => {
    try {
      const res = await getWhatsAppSettings();
      if (res.success && res.data) {
        setSettings({
          daily_report_enabled: res.data.daily_report_enabled ?? true,
          daily_report_time: res.data.daily_report_time || '07:00',
          daily_report_include_pdf: res.data.daily_report_include_pdf || false
        });
      }
    } catch (err) {
      console.error('Failed to load WhatsApp settings:', err);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      const res = await updateWhatsAppSettings(settings);
      if (res.success) {
        showNotification('success', 'WhatsApp settings saved successfully.');
      }
    } catch (err) {
      showNotification('error', err.response?.data?.error || 'Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const loadRecipients = async () => {
    try {
      setLoading(true);
      const res = await getRecipients();
      if (res.success) {
        setRecipients(res.data || []);
        setSuggestions(res.suggestions || []);
      }
    } catch (err) {
      console.error('Failed to load recipients:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecipient = async (e) => {
    e.preventDefault();
    if (!newRecipient.consentConfirmed && newRecipient.optIn) {
      showNotification('error', 'Consent confirmation is required to activate WhatsApp notifications.');
      return;
    }

    try {
      setSubmittingRecipient(true);
      const res = await createRecipient(newRecipient);
      if (res.success) {
        showNotification('success', 'Recipient added successfully.');
        setShowAddModal(false);
        setNewRecipient({
          name: '',
          phone: '',
          role: 'owner',
          optIn: true,
          consentConfirmed: false,
          receiveRefill: true,
          receiveTheft: true,
          receiveDailyReport: true
        });
        loadRecipients();
      }
    } catch (err) {
      showNotification('error', err.response?.data?.error || 'Failed to add recipient.');
    } finally {
      setSubmittingRecipient(false);
    }
  };

  const handleDeleteRecipient = async (id) => {
    if (!window.confirm('Are you sure you want to delete this WhatsApp recipient?')) return;
    try {
      const res = await deleteRecipient(id);
      if (res.success) {
        showNotification('success', 'Recipient removed.');
        loadRecipients();
      }
    } catch (err) {
      showNotification('error', 'Failed to delete recipient.');
    }
  };

  const handleToggleOptIn = async (recipient) => {
    const nextState = !recipient.opt_in;
    if (nextState) {
      const confirmed = window.confirm(
        `Confirm explicit consent: Has recipient "${recipient.name}" agreed to receive WhatsApp notifications?`
      );
      if (!confirmed) return;
    }

    try {
      const res = await updateRecipient(recipient.id, {
        optIn: nextState,
        consentConfirmed: true
      });
      if (res.success) {
        showNotification('success', `Recipient ${nextState ? 'opted in' : 'opted out'}.`);
        loadRecipients();
      }
    } catch (err) {
      showNotification('error', err.response?.data?.error || 'Failed to update opt-in state.');
    }
  };

  const loadLogs = async (page = 1) => {
    try {
      const params = {
        page,
        limit: 15,
        status: logFilterStatus || undefined,
        eventType: logFilterEvent || undefined
      };
      const res = await getWhatsAppMessages(params);
      if (res.success) {
        setLogs(res.data || []);
        setPagination(res.pagination || { page: 1, limit: 15, total: 0, pages: 1 });
      }
    } catch (err) {
      console.error('Failed to load message logs:', err);
    }
  };

  const handleRetryMessage = async (id) => {
    try {
      const res = await retryWhatsAppMessage(id);
      if (res.success) {
        showNotification('success', 'Message re-queued for sending.');
        loadLogs(pagination.page);
      }
    } catch (err) {
      showNotification('error', 'Failed to retry message.');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      queued: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      sending: 'bg-blue-100 text-blue-800 border-blue-300',
      sent: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      delivered: 'bg-green-100 text-green-800 border-green-300',
      read: 'bg-emerald-100 text-emerald-800 border-emerald-400 font-semibold',
      failed: 'bg-orange-100 text-orange-800 border-orange-300',
      dead: 'bg-red-100 text-red-800 border-red-300'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs border ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen text-slate-800 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              cursor: 'pointer',
              color: '#334155',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease',
              flexShrink: 0
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#94A3B8'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
            title="Go Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-7 h-7 text-green-600" />
              <h1 className="text-2xl font-bold text-slate-900">WhatsApp Notifications</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Meta WhatsApp Cloud API integration for finalized refills, theft alerts, and daily fleet reports.
            </p>
          </div>
        </div>

        {message && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border shadow-sm ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{message.text}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6 gap-6">
        <button
          onClick={() => setActiveTab('recipients')}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'recipients' ? 'border-green-600 text-green-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          Recipients ({recipients.length})
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'settings' ? 'border-green-600 text-green-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          Schedule & Fleet Report
        </button>
        <button
          onClick={() => { setActiveTab('logs'); loadLogs(1); }}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'logs' ? 'border-green-600 text-green-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          Message Outbox Log
        </button>
      </div>

      {/* TAB 1: RECIPIENTS */}
      {activeTab === 'recipients' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Registered Recipients</h2>
              <p className="text-xs text-slate-500">Only opted-in recipients will receive automated WhatsApp template alerts.</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> Add Recipient
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-medium">
                  <tr>
                    <th className="px-5 py-3">Name & Role</th>
                    <th className="px-5 py-3">Phone</th>
                    <th className="px-5 py-3">Opt-In Status</th>
                    <th className="px-5 py-3">Alert Types</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recipients.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-5 py-8 text-center text-slate-400">
                        No WhatsApp recipients registered yet. Click "Add Recipient" to register one.
                      </td>
                    </tr>
                  ) : (
                    recipients.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-slate-900">{r.name}</div>
                          <span className="text-xs text-slate-400 capitalize">{r.role}</span>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-600">
                          {r.phone_masked}
                        </td>
                        <td className="px-5 py-3.5">
                          {r.opt_in ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                              <Check className="w-3 h-3" /> Opted In
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                              <X className="w-3 h-3" /> Opted Out
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1.5 text-xs">
                            {r.receive_refill && <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Refill</span>}
                            {r.receive_theft && <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">Theft</span>}
                            {r.receive_daily_report && <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Daily Report</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-2">
                          <button
                            onClick={() => handleToggleOptIn(r)}
                            className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
                          >
                            {r.opt_in ? 'Opt Out' : 'Opt In'}
                          </button>
                          <button
                            onClick={() => handleDeleteRecipient(r.id)}
                            className="text-rose-600 hover:text-rose-800 p-1 inline-block"
                            title="Delete recipient"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-lg font-bold text-slate-900">Daily Fleet Report Configuration</h2>
            <p className="text-xs text-slate-500 mt-1">
              Consolidated automated WhatsApp summary sent once per day for all active fleet vehicles.
            </p>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.daily_report_enabled}
                onChange={(e) => setSettings({ ...settings, daily_report_enabled: e.target.checked })}
                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
              />
              <div>
                <span className="text-sm font-semibold text-slate-900">Enable Daily Fleet Report</span>
                <p className="text-xs text-slate-500">Automatically sends yesterday's summary (distance, fuel, refills, theft, idle time).</p>
              </div>
            </label>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                Delivery Time (IST - Asia/Kolkata)
              </label>
              <input
                type="time"
                value={settings.daily_report_time}
                onChange={(e) => setSettings({ ...settings, daily_report_time: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-slate-400 mt-1">Default is 07:00 IST (UTC 01:30).</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: OUTBOX LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={logFilterStatus}
                onChange={(e) => { setLogFilterStatus(e.target.value); }}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">All Statuses</option>
                <option value="queued">Queued</option>
                <option value="sending">Sending</option>
                <option value="sent">Sent</option>
                <option value="delivered">Delivered</option>
                <option value="read">Read</option>
                <option value="failed">Failed</option>
                <option value="dead">Dead</option>
              </select>

              <select
                value={logFilterEvent}
                onChange={(e) => { setLogFilterEvent(e.target.value); }}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">All Events</option>
                <option value="fuel_refill">Fuel Refill</option>
                <option value="fuel_theft">Fuel Theft</option>
                <option value="daily_report">Daily Fleet Report</option>
              </select>

              <button
                onClick={() => loadLogs(1)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Filter
              </button>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Total Messages: {pagination.total}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-medium">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Recipient</th>
                    <th className="px-4 py-3">Event & Template</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created / Sent At</th>
                    <th className="px-4 py-3">Error / WAMID</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-slate-400 font-sans">
                        No messages found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    logs.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-slate-500">#{m.id}</td>
                        <td className="px-4 py-3">
                          <div className="font-sans font-medium text-slate-900">{m.recipient_name || 'Recipient'}</div>
                          <div className="text-slate-400">{m.phone_masked}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="capitalize font-sans font-medium text-slate-800">{m.event_type.replace(/_/g, ' ')}</span>
                          <div className="text-slate-400">{m.template_name}</div>
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(m.status)}
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-sans">
                          <div>{new Date(m.created_at).toLocaleTimeString()}</div>
                          <div className="text-xs text-slate-400">{new Date(m.created_at).toLocaleDateString()}</div>
                        </td>
                        <td className="px-4 py-3">
                          {m.error_message ? (
                            <span className="text-rose-600" title={m.error_message}>
                              [{m.error_code}] {m.error_message.slice(0, 30)}...
                            </span>
                          ) : (
                            <span className="text-slate-400">{m.wamid ? m.wamid.slice(0, 15) + '...' : '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {(m.status === 'failed' || m.status === 'dead') && (
                            <button
                              onClick={() => handleRetryMessage(m.id)}
                              className="font-sans text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1 rounded border border-slate-300 font-medium inline-flex items-center gap-1"
                            >
                              <Send className="w-3 h-3" /> Retry
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex justify-between items-center px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
                <span>Page {pagination.page} of {pagination.pages}</span>
                <div className="space-x-2">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => loadLogs(pagination.page - 1)}
                    className="px-3 py-1 bg-slate-100 rounded border border-slate-200 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    disabled={pagination.page >= pagination.pages}
                    onClick={() => loadLogs(pagination.page + 1)}
                    className="px-3 py-1 bg-slate-100 rounded border border-slate-200 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD RECIPIENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Add WhatsApp Recipient</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddRecipient} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Recipient Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newRecipient.name}
                  onChange={(e) => setNewRecipient({ ...newRecipient, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Phone Number (10 digits / E.164)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9000666914 or +91 90006 66914"
                  value={newRecipient.phone}
                  onChange={(e) => setNewRecipient({ ...newRecipient, phone: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
                {suggestions.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-slate-400">Suggestions:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {suggestions.slice(0, 3).map((s, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setNewRecipient({ ...newRecipient, phone: s.raw })}
                          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded"
                        >
                          {s.masked} ({s.source})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Role</label>
                <select
                  value={newRecipient.role}
                  onChange={(e) => setNewRecipient({ ...newRecipient, role: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                >
                  <option value="owner">Owner / Fleet Executive</option>
                  <option value="manager">Operations Manager</option>
                  <option value="driver">Driver</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Event Toggles */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="block text-xs font-semibold text-slate-700 uppercase">Subscribe to Events</span>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRecipient.receiveRefill}
                    onChange={(e) => setNewRecipient({ ...newRecipient, receiveRefill: e.target.checked })}
                    className="w-3.5 h-3.5 text-green-600 rounded"
                  />
                  <span>Finalized Fuel Refill Alerts</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRecipient.receiveTheft}
                    onChange={(e) => setNewRecipient({ ...newRecipient, receiveTheft: e.target.checked })}
                    className="w-3.5 h-3.5 text-green-600 rounded"
                  />
                  <span>Fuel Theft Alerts</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRecipient.receiveDailyReport}
                    onChange={(e) => setNewRecipient({ ...newRecipient, receiveDailyReport: e.target.checked })}
                    className="w-3.5 h-3.5 text-green-600 rounded"
                  />
                  <span>Daily Fleet Report</span>
                </label>
              </div>

              {/* Consent Checkbox */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={newRecipient.consentConfirmed}
                    onChange={(e) => setNewRecipient({ ...newRecipient, consentConfirmed: e.target.checked })}
                    className="mt-0.5 w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-xs text-emerald-900 leading-snug">
                    <strong>Explicit Consent Confirmation:</strong> I confirm this recipient has explicitly opted in to receive automated WhatsApp notifications from FuelTracks.
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRecipient || !newRecipient.consentConfirmed}
                  className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition shadow-sm"
                >
                  {submittingRecipient ? 'Saving...' : 'Add Recipient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppSettingsPage;

