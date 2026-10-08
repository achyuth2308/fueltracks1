import React, { useState, useEffect } from 'react';
import {
  Truck,
  Search,
  Download,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  FileText,
  Smartphone,
  Cpu,
  Calendar,
  User,
  Shield,
  MapPin,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  RefreshCw,
  X,
  File as FileIcon,
  Trash2,
  Check,
  Globe
} from 'lucide-react';
import miningRegistrationApi from '../../api/miningRegistrationApi';
import GoogleFormModal from '../../components/GoogleFormModal';
import { useAuth } from '../../hooks/useAuth';

const MiningRegistrationsAdminPage = () => {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [requestTypeFilter, setRequestTypeFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 15 });

  // Detail Modal State
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Image zoom modal
  const [zoomedMedia, setZoomedMedia] = useState(null);
  const [isGoogleFormModalOpen, setIsGoogleFormModalOpen] = useState(false);

  const fetchRegistrations = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 15,
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        requestType: requestTypeFilter !== 'ALL' ? requestTypeFilter : undefined,
      };

      const res = await miningRegistrationApi.getRegistrations(params);
      if (res.success) {
        setRegistrations(res.data);
        setPagination(res.pagination || { total: res.data.length, totalPages: 1, limit: 15 });
      } else {
        setError(res.error || 'Failed to load registrations');
      }
    } catch (err) {
      console.error('Error loading registrations:', err);
      setError('An error occurred while fetching registrations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, [page, statusFilter, requestTypeFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchRegistrations();
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const handleOpenDetails = (record) => {
    setSelectedRecord(record);
    setAdminNotes(record.admin_notes || '');
    setStatusMessage('');
    setIsDetailModalOpen(true);
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedRecord) return;
    setStatusUpdating(true);
    setStatusMessage('');
    try {
      const res = await miningRegistrationApi.updateStatus(selectedRecord.id, {
        status: newStatus,
        admin_notes: adminNotes,
      });
      if (res.success) {
        setSelectedRecord(res.data);
        setStatusMessage(`Status successfully updated to ${newStatus}`);
        fetchRegistrations();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this registration record and its uploaded files?')) {
      return;
    }
    try {
      await miningRegistrationApi.deleteRegistration(id);
      fetchRegistrations();
      if (selectedRecord?.id === id) {
        setIsDetailModalOpen(false);
      }
    } catch (err) {
      alert('Failed to delete registration record.');
    }
  };

  const handleExportCsv = async () => {
    try {
      await miningRegistrationApi.exportCsv({
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        requestType: requestTypeFilter !== 'ALL' ? requestTypeFilter : undefined,
      });
    } catch (err) {
      alert('Failed to export CSV.');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle size={12} /> Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle size={12} /> Rejected
          </span>
        );
      case 'IN_REVIEW':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-sky-100 text-sky-800 border border-sky-200">
            <Clock size={12} /> In Review
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock size={12} /> Pending
          </span>
        );
    }
  };

  const getFileUrl = (relativeUrl) => {
    if (!relativeUrl) return null;
    const base = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    return `${base}${relativeUrl}`;
  };

  // Stats Counters
  const pendingCount = registrations.filter(r => r.status === 'PENDING').length;
  const approvedCount = registrations.filter(r => r.status === 'APPROVED').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 20px', gap: '12px', background: '#f8fafc', boxSizing: 'border-box' }}>
      {/* Top Header Bar */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
            <Truck size={14} />
            <span>Compliance & Hardware Onboarding</span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
            Vehicle & Mining Registrations
          </h1>
          <p style={{ fontSize: '12px', color: '#475569', margin: '2px 0 0 0' }}>
            Review submissions, inspect compliance documents (RC, Aadhar, Plate), and approve vehicle telemetry.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsGoogleFormModalOpen(true)}
            style={{ padding: '6px 12px', background: '#ea580c', color: '#ffffff', borderRadius: '8px', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer' }}
            title="Get shareable Google Form link for technicians & dealers"
          >
            <Globe size={14} /> Google Form Link
          </button>
          <button
            onClick={handleExportCsv}
            style={{ padding: '6px 12px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155', borderRadius: '8px', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            onClick={() => fetchRegistrations()}
            style={{ padding: '6px 10px', background: '#0f172a', color: '#ffffff', borderRadius: '8px', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer' }}
            title="Refresh List"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Compact Filters & Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', background: '#ffffff', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search by vehicle no, customer, phone, IMEI, installer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '6px 10px 6px 32px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none', color: '#0f172a', boxSizing: 'border-box' }}
          />
        </div>

        {/* Dropdown Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700, color: '#334155', background: '#ffffff', outline: 'none' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            value={requestTypeFilter}
            onChange={(e) => {
              setRequestTypeFilter(e.target.value);
              setPage(1);
            }}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700, color: '#334155', background: '#ffffff', outline: 'none' }}
          >
            <option value="ALL">All Request Types</option>
            <option value="New Installation">New Installation</option>
            <option value="Replacement">Replacement</option>
            <option value="Repair">Repair</option>
            <option value="Renewal">Renewal</option>
            <option value="Device Transfer">Device Transfer</option>
          </select>
        </div>

        {/* Inline Stats Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <span style={{ color: '#475569', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
            Total: <strong style={{ color: '#0f172a', fontWeight: 700 }}>{pagination.total}</strong>
          </span>
          <span style={{ color: '#d97706', background: '#fffbeb', padding: '4px 8px', borderRadius: '6px', border: '1px solid #fde68a' }}>
            Pending: <strong style={{ color: '#b45309', fontWeight: 700 }}>{pendingCount}</strong>
          </span>
          <span style={{ color: '#059669', background: '#ecfdf5', padding: '4px 8px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
            Approved: <strong style={{ color: '#047857', fontWeight: 700 }}>{approvedCount}</strong>
          </span>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px' }}>
          <Loader2 size={30} color="#ea580c" className="animate-spin" />
          <span style={{ fontSize: '13px', color: '#64748b', marginTop: '12px' }}>Loading registrations...</span>
        </div>
      ) : error ? (
        <div style={{ padding: '40px', textAlign: 'center', flex: 1 }}>
          <AlertTriangle size={32} color="#ef4444" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>Failed to Load Records</div>
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{error}</div>
        </div>
      ) : registrations.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Truck size={36} color="#94a3b8" />
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginTop: '8px' }}>No registrations found</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Try adjusting your search query or status filter.</div>
        </div>
      ) : (
        <div style={{ overflowY: 'auto', flex: 1, background: '#ffffff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#1e1b4b', position: 'sticky', top: 0, zIndex: 10 }}>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>VEHICLE NO</th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>CUSTOMER</th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>DEVICE MODEL</th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>IMEI NO</th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>ASM / TSL PHONE</th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>REQUEST TYPE</th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>SUBMITTED BY</th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>STATUS</th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>DATE</th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em', textAlign: 'center' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '12px', color: '#1e293b' }}>
                {registrations.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => handleOpenDetails(item)}
                    style={{ borderBottom: '1px solid #e0e7ff', height: '38px', transition: 'background 0.15s', cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f5f3ff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', borderRight: '1px solid #e2e8f0' }}>
                      {item.vehicle_number}
                    </td>
                    <td style={{ padding: '6px 12px', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: 700, color: '#1e293b' }}>{item.customer_name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{item.customer_phone}</div>
                    </td>
                    <td style={{ padding: '6px 12px', fontWeight: 600, color: '#334155', borderRight: '1px solid #e2e8f0' }}>
                      {item.device_model}
                    </td>
                    <td style={{ padding: '6px 12px', fontFamily: 'monospace', color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                      {item.imei_number || '—'}
                    </td>
                    <td style={{ padding: '6px 12px', fontFamily: 'monospace', color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                      {item.asm_tsl_phone}
                    </td>
                    <td style={{ padding: '6px 12px', borderRight: '1px solid #e2e8f0' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#334155', fontSize: '11px', fontWeight: 700 }}>
                        {item.request_type}
                      </span>
                    </td>
                    <td style={{ padding: '6px 12px', color: '#64748b', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderRight: '1px solid #e2e8f0' }} title={item.submitted_by_email}>
                      {item.submitted_by_email}
                    </td>
                    <td style={{ padding: '6px 12px', borderRight: '1px solid #e2e8f0' }}>
                      {getStatusBadge(item.status)}
                    </td>
                    <td style={{ padding: '6px 12px', color: '#64748b', whiteSpace: 'nowrap', borderRight: '1px solid #e2e8f0' }}>
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <button
                          onClick={() => handleOpenDetails(item)}
                          style={{ padding: '4px', color: '#ea580c', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                          title="View Details & Documents"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={(e) => handleDelete(item.id, e)}
                          style={{ padding: '4px', color: '#94a3b8', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                          title="Delete Record"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            Showing {(page - 1) * pagination.limit + 1} to{' '}
            {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} entries
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="font-bold text-slate-800">
              Page {page} of {pagination.totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

      {/* ============================================================== */}
      {/* RECORD DETAILS & COMPLIANCE MODAL */}
      {/* ============================================================== */}
      {isDetailModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-orange-400 uppercase tracking-widest">
                    Registration Dossier
                  </span>
                  {getStatusBadge(selectedRecord.status)}
                </div>
                <h2 className="text-xl font-black mt-1 flex items-center gap-3">
                  <span className="font-mono">{selectedRecord.vehicle_number}</span>
                  <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                    Ref: {selectedRecord.id.slice(0, 8)}...
                  </span>
                </h2>
              </div>

              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-slate-700">
              {statusMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 font-bold flex items-center gap-2">
                  <CheckCircle size={15} /> {statusMessage}
                </div>
              )}

              {/* Status Update Quick Bar */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <span className="font-extrabold text-slate-800 uppercase tracking-wider block text-[11px]">
                  Workflow Action
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={statusUpdating || selectedRecord.status === 'APPROVED'}
                    onClick={() => handleUpdateStatus('APPROVED')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <CheckCircle size={14} /> Approve Registration
                  </button>
                  <button
                    type="button"
                    disabled={statusUpdating || selectedRecord.status === 'IN_REVIEW'}
                    onClick={() => handleUpdateStatus('IN_REVIEW')}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <Clock size={14} /> Mark In Review
                  </button>
                  <button
                    type="button"
                    disabled={statusUpdating || selectedRecord.status === 'REJECTED'}
                    onClick={() => handleUpdateStatus('REJECTED')}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                </div>

                <div className="pt-2">
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">
                    Admin / Auditor Remarks
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter approval or rejection remarks for audit records..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none resize-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Technical Specifications */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block font-medium">Device Model</span>
                  <span className="font-bold text-slate-900">{selectedRecord.device_model}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">IMEI Number</span>
                  <span className="font-mono font-bold text-slate-900">{selectedRecord.imei_number || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Manufacturing Year</span>
                  <span className="font-bold text-slate-900">{selectedRecord.manufacturing_year}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Manufacturer</span>
                  <span className="font-bold text-slate-900">{selectedRecord.vehicle_manufacturer}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Engine Number</span>
                  <span className="font-mono font-bold text-slate-900">{selectedRecord.engine_number}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Chassis Number</span>
                  <span className="font-mono font-bold text-slate-900">{selectedRecord.chassis_number}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Customer Name</span>
                  <span className="font-bold text-slate-900">{selectedRecord.customer_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Customer Phone</span>
                  <span className="font-mono font-bold text-slate-900">{selectedRecord.customer_phone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">ASM / TSL Phone</span>
                  <span className="font-mono font-bold text-slate-900">{selectedRecord.asm_tsl_phone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Installer Name</span>
                  <span className="font-bold text-slate-900">{selectedRecord.installer_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Request Type</span>
                  <span className="font-bold text-slate-900">{selectedRecord.request_type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Aadhar Number</span>
                  <span className="font-mono font-bold text-slate-900">
                    XXXX-XXXX-{(selectedRecord.aadhar_number || '').slice(-4)}
                  </span>
                </div>
              </div>

              {/* FO's Address */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-slate-400 block font-medium mb-0.5">FO's Address (as on Aadhar)</span>
                <p className="font-medium text-slate-800 whitespace-pre-line">{selectedRecord.fo_address}</p>
              </div>

              {/* Compliance Documents & Photos */}
              <div>
                <span className="font-extrabold text-slate-800 uppercase tracking-wider block text-[11px] mb-3">
                  Uploaded Documents & Proofs (Click to preview full size)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Vehicle Number Photo', url: selectedRecord.vehicle_number_photo_url },
                    { label: 'RC Copy Photo', url: selectedRecord.rc_copy_photo_url },
                    { label: 'Aadhar Copy Photo', url: selectedRecord.aadhar_copy_photo_url },
                  ].map(({ label, url }) => {
                    const fullUrl = getFileUrl(url);
                    const isPdf = url && url.toLowerCase().endsWith('.pdf');

                    return (
                      <div
                        key={label}
                        className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col items-center justify-between text-center gap-2 group hover:border-orange-400 transition-all"
                      >
                        <span className="text-[11px] font-bold text-slate-700">{label}</span>
                        {isPdf ? (
                          <a
                            href={fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full h-28 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex flex-col items-center justify-center gap-1.5 hover:bg-rose-100 transition-colors"
                          >
                            <FileIcon size={32} />
                            <span className="font-bold text-[11px] flex items-center gap-1">
                              View PDF <ExternalLink size={11} />
                            </span>
                          </a>
                        ) : fullUrl ? (
                          <div
                            onClick={() => setZoomedMedia({ url: fullUrl, title: label })}
                            className="w-full h-28 rounded-xl overflow-hidden border border-slate-200 relative cursor-pointer group"
                          >
                            <img
                              src={fullUrl}
                              alt={label}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold text-xs gap-1 transition-opacity">
                              <Eye size={14} /> Zoom
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-28 rounded-xl bg-slate-200 text-slate-400 flex items-center justify-center font-bold text-xs">
                            No File
                          </div>
                        )}

                        {fullUrl && (
                          <a
                            href={fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-orange-600 hover:underline flex items-center gap-1 mt-1"
                          >
                            Open Original <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
              <button
                type="button"
                onClick={(e) => handleDelete(selectedRecord.id, e)}
                className="px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 size={15} /> Delete Registration
              </button>

              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-6 py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* FULL-SIZE IMAGE ZOOM MODAL */}
      {/* ============================================================== */}
      {zoomedMedia && (
        <div
          onClick={() => setZoomedMedia(null)}
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-transparent flex flex-col items-center">
            <div className="mb-2 text-white font-bold text-sm bg-black/60 px-4 py-1.5 rounded-full">
              {zoomedMedia.title} (Click anywhere to close)
            </div>
            <img
              src={zoomedMedia.url}
              alt={zoomedMedia.title}
              className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl object-contain border border-white/20"
            />
          </div>
        </div>
      )}

      {/* Google Form Link & Integration Modal */}
      <GoogleFormModal
        isOpen={isGoogleFormModalOpen}
        onClose={() => setIsGoogleFormModalOpen(false)}
      />
    </div>
  );
};

export default MiningRegistrationsAdminPage;
