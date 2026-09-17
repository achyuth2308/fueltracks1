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
    <div className="pastel-page-bg min-h-screen p-4 sm:p-8 flex flex-col box-sizing-border">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-extrabold text-orange-600 uppercase tracking-wider mb-1">
            <Truck size={16} />
            <span>Compliance & Hardware Onboarding</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Vehicle & Mining Registrations
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Review submissions, inspect compliance documents (RC, Aadhar, Plate), and approve vehicle telemetry.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-3 shrink-0">
          <button
            onClick={() => setIsGoogleFormModalOpen(true)}
            className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            title="Get shareable Google Form link for technicians & dealers"
          >
            <Globe size={15} /> Google Form Link
          </button>
          <button
            onClick={handleExportCsv}
            className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            onClick={() => fetchRegistrations()}
            className="p-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Submissions</span>
          <p className="text-2xl font-black text-slate-900 mt-1">{pagination.total}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Pending Action</span>
          <p className="text-2xl font-black text-amber-600 mt-1">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Approved Vehicles</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">{approvedCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-sky-600 uppercase tracking-wider">Current Page</span>
          <p className="text-2xl font-black text-slate-900 mt-1">{page} / {pagination.totalPages || 1}</p>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs mb-6 flex flex-col sm:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by vehicle no, customer, phone, IMEI, installer, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 outline-none bg-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {/* Request Type Filter */}
          <select
            value={requestTypeFilter}
            onChange={(e) => {
              setRequestTypeFilter(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 outline-none bg-white"
          >
            <option value="ALL">All Request Types</option>
            <option value="New Installation">New Installation</option>
            <option value="Replacement">Replacement</option>
            <option value="Repair">Repair</option>
            <option value="Renewal">Renewal</option>
            <option value="Device Transfer">Device Transfer</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden flex-1 flex flex-col">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 size={32} className="animate-spin text-orange-500" />
            <p className="text-xs font-bold text-slate-500">Loading registrations...</p>
          </div>
        ) : error ? (
          <div className="p-16 text-center text-rose-600">
            <AlertTriangle size={32} className="mx-auto mb-2" />
            <p className="font-bold text-sm">{error}</p>
          </div>
        ) : registrations.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Truck size={40} className="mx-auto mb-3 text-slate-300" />
            <h3 className="font-bold text-slate-700 text-base">No registrations found</h3>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your search query or status filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Vehicle No</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Device Model</th>
                  <th className="py-3.5 px-4">IMEI No</th>
                  <th className="py-3.5 px-4">ASM / TSL Phone</th>
                  <th className="py-3.5 px-4">Request Type</th>
                  <th className="py-3.5 px-4">Submitted By</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {registrations.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => handleOpenDetails(item)}
                    className="hover:bg-orange-50/30 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {item.vehicle_number}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800">{item.customer_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{item.customer_phone}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800">{item.device_model}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {item.imei_number || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {item.asm_tsl_phone}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold">
                        {item.request_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 truncate max-w-[150px]" title={item.submitted_by_email}>
                      {item.submitted_by_email}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenDetails(item)}
                          className="p-1.5 text-orange-600 hover:bg-orange-100 rounded-lg transition-colors cursor-pointer"
                          title="View Details & Documents"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={(e) => handleDelete(item.id, e)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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
