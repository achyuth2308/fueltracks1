import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { formatLocalDate, formatLocalTime } from '../../utils/dateUtils';
import { Loader2, AlertTriangle, Search, FileText, CalendarX2, CreditCard, DollarSign, Edit3, Clock, CheckCircle, Settings, Download, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import * as adminApi from '../../api/adminApi';
import SetRenewalAmountModal from '../../components/modals/SetRenewalAmountModal';

const BillingAdminPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('licenses'); // 'licenses' | 'transactions'

  const [licenses, setLicenses] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'Active' | 'Expiring' | 'Expired'
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Modal state
  const [selectedVehicleForAmount, setSelectedVehicleForAmount] = useState(null);
  const [isAmountModalOpen, setIsAmountModalOpen] = useState(false);

  const fetchLicenses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getExpiredLicenses();
      if (res.success) {
        setLicenses(res.data);
      } else {
        setError('Failed to load vehicle licenses.');
      }
    } catch (err) {
      setError('An error occurred while fetching billing data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getRenewalTransactions();
      if (res.success) {
        setTransactions(res.data);
      } else {
        setError('Failed to load transaction history.');
      }
    } catch (err) {
      setError('An error occurred while fetching transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'licenses') {
      fetchLicenses();
    } else {
      fetchTransactions();
    }
  }, [activeTab]);

  const openSetAmountModal = (license) => {
    setSelectedVehicleForAmount(license);
    setIsAmountModalOpen(true);
  };

  const handleSetAmountSuccess = () => {
    fetchLicenses();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return formatLocalDate(dateStr);
  };

  const filteredLicenses = licenses.filter(l => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (l.vehicleName || '').toLowerCase().includes(q) ||
      (l.vehicleId || '').toLowerCase().includes(q) ||
      (l.deviceId || '').toLowerCase().includes(q) ||
      (l.licenceId || '').toLowerCase().includes(q) ||
      (l.organization || '').toLowerCase().includes(q) ||
      (l.username || '').toLowerCase().includes(q) ||
      (l.customerName || '').toLowerCase().includes(q) ||
      (l.phone || '').toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q) ||
      (l.gpsSimNo || '').toLowerCase().includes(q) ||
      (l.gpsSimNo1 || '').toLowerCase().includes(q) ||
      (l.gpsSimNo2 || '').toLowerCase().includes(q);

    if (!matchesSearch) return false;
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    return true;
  });

  const filteredTransactions = transactions.filter(t =>
    (t.payment_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.vehicle_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.user_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.user_email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = licenses.filter(l => l.status === 'Active').length;
  const expiringCount = licenses.filter(l => l.status === 'Expiring').length;
  const expiredCount = licenses.filter(l => l.status === 'Expired').length;

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, statusFilter]);

  const currentList = activeTab === 'licenses' ? filteredLicenses : filteredTransactions;
  const totalPages = Math.ceil(currentList.length / pageSize) || 1;
  const activePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const paginatedLicenses = filteredLicenses.slice(startIndex, startIndex + pageSize);
  const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + pageSize);

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (activePage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (activePage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', activePage - 1, activePage, activePage + 1, '...', totalPages];
  };

  const handleExportExcel = (filterType = 'all') => {
    let exportList = licenses;
    let typeName = 'All';

    if (filterType === 'Active') {
      exportList = licenses.filter(l => l.status === 'Active');
      typeName = 'Active';
    } else if (filterType === 'Expiring') {
      exportList = licenses.filter(l => l.status === 'Expiring');
      typeName = 'Expiring';
    } else if (filterType === 'Expired') {
      exportList = licenses.filter(l => l.status === 'Expired');
      typeName = 'Expired';
    }

    const rows = exportList.map((item, index) => {
      const issuedDate = item.licenceIssuedDate ? formatLocalDate(item.licenceIssuedDate) : '-';
      const expiryDate = item.licenceExpiryDate ? formatLocalDate(item.licenceExpiryDate) : '-';

      let daysStatus = '-';
      if (item.diffDays !== null && item.diffDays !== undefined) {
        if (item.diffDays < 0) {
          daysStatus = `${Math.abs(item.diffDays)} days overdue`;
        } else if (item.diffDays === 0) {
          daysStatus = 'Expires Today';
        } else {
          daysStatus = `${item.diffDays} days remaining`;
        }
      }

      return {
        'S.No': index + 1,
        'Username': item.username || '-',
        'Customer / Owner Name': item.customerName || '-',
        'Phone Number': item.phone || '-',
        'Email': item.email || '-',
        'GPS SIM 1': item.gpsSimNo1 || item.gpsSimNo || '-',
        'GPS SIM 2': item.gpsSimNo2 || '-',
        'Vehicle Name': item.vehicleName || '-',
        'Vehicle Plate / ID': item.vehicleId || '-',
        'Device IMEI / ID': item.deviceId || '-',
        'Device Model': item.deviceModel || '-',
        'Organization': item.organization || '-',
        'Dealer': item.dealerName || '-',
        'Licence ID': item.licenceId || '-',
        'Licence Type': item.licenceType || '-',
        'Status': item.status || '-',
        'Licence Issued Date': issuedDate,
        'Licence Expiry Date': expiryDate,
        'Days Remaining / Overdue': daysStatus,
        'Plan Duration': item.durationMonths ? `${item.durationMonths} Months` : '12 Months'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 6 },  // S.No
      { wch: 18 }, // Username
      { wch: 22 }, // Customer / Owner Name
      { wch: 16 }, // Phone Number
      { wch: 26 }, // Email
      { wch: 18 }, // GPS SIM 1
      { wch: 18 }, // GPS SIM 2
      { wch: 20 }, // Vehicle Name
      { wch: 18 }, // Vehicle Plate / ID
      { wch: 18 }, // Device IMEI / ID
      { wch: 14 }, // Device Model
      { wch: 22 }, // Organization
      { wch: 22 }, // Dealer
      { wch: 18 }, // Licence ID
      { wch: 14 }, // Licence Type
      { wch: 12 }, // Status
      { wch: 18 }, // Licence Issued Date
      { wch: 18 }, // Licence Expiry Date
      { wch: 24 }, // Days Remaining / Overdue
      { wch: 16 }  // Plan Duration
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${typeName}_Licenses`);
    const dateStamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `FuelTracks_Billing_${typeName}_Licenses_${dateStamp}.xlsx`);
  };

  return (
    <div className="pastel-page-bg" style={{ padding: '32px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={28} color="#f97316" />
            Billing & Subscriptions
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>
            Manage vehicle license prices, expiry warnings, and view payment transaction history.
          </p>
        </div>

        {/* Tab Navigation Buttons */}
        <div style={{ display: 'flex', gap: '8px', background: '#E2E8F0', padding: '4px', borderRadius: '12px' }}>
          <button
            onClick={() => { setActiveTab('licenses'); setSearchQuery(''); setStatusFilter('all'); }}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: activeTab === 'licenses' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'licenses' ? '#0F172A' : '#64748B',
              boxShadow: activeTab === 'licenses' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <CreditCard size={16} />
            Vehicle Licenses
          </button>
          <button
            onClick={() => { setActiveTab('transactions'); setSearchQuery(''); }}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: activeTab === 'transactions' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'transactions' ? '#0F172A' : '#64748B',
              boxShadow: activeTab === 'transactions' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <Clock size={16} />
            Transaction History
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>
        <div style={{
          background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
          boxShadow: '0 4px 6px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column',
          flex: '1', overflow: 'hidden'
        }}>

          {/* Search Bar & Interactive Status Filter / Export */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 sm:px-5 border-b border-slate-200">
            <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
              <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} size={16} />
              <input
                type="text"
                placeholder={activeTab === 'licenses' ? "Search vehicle, IMEI, SIM, user..." : "Search transaction ID, vehicle, user..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px 10px 38px',
                  borderRadius: '10px', border: '1px solid #CBD5E1',
                  fontSize: '14px', outline: 'none', color: '#111827', boxSizing: 'border-box'
                }}
              />
            </div>

            {activeTab === 'licenses' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {/* Status Filter Buttons */}
                <div style={{ display: 'flex', gap: '6px', background: '#F1F5F9', padding: '3px', borderRadius: '10px' }}>
                  <button
                    onClick={() => setStatusFilter('all')}
                    style={{
                      padding: '5px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 700,
                      border: statusFilter === 'all' ? '1px solid #CBD5E1' : '1px solid transparent',
                      cursor: 'pointer', transition: 'all 0.15s',
                      background: statusFilter === 'all' ? '#FFFFFF' : 'transparent',
                      color: statusFilter === 'all' ? '#0F172A' : '#64748B',
                      boxShadow: statusFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                    }}
                  >
                    All <span style={{ opacity: 0.7, marginLeft: '3px' }}>({licenses.length})</span>
                  </button>

                  <button
                    onClick={() => setStatusFilter(statusFilter === 'Active' ? 'all' : 'Active')}
                    style={{
                      padding: '5px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 700,
                      border: statusFilter === 'Active' ? '1px solid #10B981' : '1px solid transparent',
                      cursor: 'pointer', transition: 'all 0.15s',
                      background: statusFilter === 'Active' ? '#ECFDF5' : 'transparent',
                      color: statusFilter === 'Active' ? '#047857' : '#059669',
                      boxShadow: statusFilter === 'Active' ? '0 1px 3px rgba(16, 185, 129, 0.15)' : 'none'
                    }}
                  >
                    Active <span style={{ marginLeft: '3px', fontWeight: 800 }}>({activeCount})</span>
                  </button>

                  <button
                    onClick={() => setStatusFilter(statusFilter === 'Expiring' ? 'all' : 'Expiring')}
                    style={{
                      padding: '5px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 700,
                      border: statusFilter === 'Expiring' ? '1px solid #F59E0B' : '1px solid transparent',
                      cursor: 'pointer', transition: 'all 0.15s',
                      background: statusFilter === 'Expiring' ? '#FFFBEB' : 'transparent',
                      color: statusFilter === 'Expiring' ? '#B45309' : '#D97706',
                      boxShadow: statusFilter === 'Expiring' ? '0 1px 3px rgba(245, 158, 11, 0.15)' : 'none'
                    }}
                  >
                    Expiring <span style={{ marginLeft: '3px', fontWeight: 800 }}>({expiringCount})</span>
                  </button>

                  <button
                    onClick={() => setStatusFilter(statusFilter === 'Expired' ? 'all' : 'Expired')}
                    style={{
                      padding: '5px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 700,
                      border: statusFilter === 'Expired' ? '1px solid #EF4444' : '1px solid transparent',
                      cursor: 'pointer', transition: 'all 0.15s',
                      background: statusFilter === 'Expired' ? '#FEF2F2' : 'transparent',
                      color: statusFilter === 'Expired' ? '#B91C1C' : '#DC2626',
                      boxShadow: statusFilter === 'Expired' ? '0 1px 3px rgba(239, 68, 68, 0.15)' : 'none'
                    }}
                  >
                    Expired <span style={{ marginLeft: '3px', fontWeight: 800 }}>({expiredCount})</span>
                  </button>
                </div>

                {/* Export Excel Dropdown */}
                <div ref={exportDropdownRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                      background: '#10B981', color: '#FFFFFF', border: 'none', cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)', transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#059669'}
                    onMouseLeave={e => e.currentTarget.style.background = '#10B981'}
                  >
                    <Download size={14} />
                    Export Excel
                    <ChevronDown size={14} style={{ transform: exportDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>

                  {exportDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute', right: 0, top: '100%', marginTop: '6px',
                        background: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                        width: '230px', padding: '6px 0', zIndex: 60
                      }}
                    >
                      <div style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Download Options
                      </div>
                      
                      <button
                        onClick={() => { handleExportExcel('all'); setExportDropdownOpen(false); }}
                        style={{
                          width: '100%', padding: '8px 14px', background: 'transparent', border: 'none',
                          textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#334155',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span>All Licenses (All-in-One)</span>
                        <span style={{ fontSize: '11px', padding: '2px 6px', background: '#F1F5F9', borderRadius: '4px', fontWeight: 700, color: '#475569' }}>
                          {licenses.length}
                        </span>
                      </button>

                      <button
                        onClick={() => { handleExportExcel('Active'); setExportDropdownOpen(false); }}
                        style={{
                          width: '100%', padding: '8px 14px', background: 'transparent', border: 'none',
                          textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#047857',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#ECFDF5'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span>Only Active</span>
                        <span style={{ fontSize: '11px', padding: '2px 6px', background: '#D1FAE5', borderRadius: '4px', fontWeight: 700, color: '#059669' }}>
                          {activeCount}
                        </span>
                      </button>

                      <button
                        onClick={() => { handleExportExcel('Expiring'); setExportDropdownOpen(false); }}
                        style={{
                          width: '100%', padding: '8px 14px', background: 'transparent', border: 'none',
                          textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#B45309',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#FFFBEB'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span>Only Expiring</span>
                        <span style={{ fontSize: '11px', padding: '2px 6px', background: '#FEF3C7', borderRadius: '4px', fontWeight: 700, color: '#D97706' }}>
                          {expiringCount}
                        </span>
                      </button>

                      <button
                        onClick={() => { handleExportExcel('Expired'); setExportDropdownOpen(false); }}
                        style={{
                          width: '100%', padding: '8px 14px', background: 'transparent', border: 'none',
                          textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#B91C1C',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span>Only Expired</span>
                        <span style={{ fontSize: '11px', padding: '2px 6px', background: '#FEE2E2', borderRadius: '4px', fontWeight: 700, color: '#DC2626' }}>
                          {expiredCount}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Loading or Error State */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <Loader2 size={32} color="#f97316" className="animate-spin" />
              <span style={{ fontSize: '14px', color: '#6B7280', marginTop: '12px' }}>Loading billing data...</span>
            </div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center', flex: 1 }}>
              <AlertTriangle size={32} color="#EF4444" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Failed to Load Records</div>
              <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>{error}</div>
            </div>
          ) : activeTab === 'licenses' ? (
            /* TAB 1: VEHICLE LICENSES & EXPIRY MANAGEMENT */
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <table
                className="pastel-table"
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                  height: filteredLicenses.length === 0 ? '100%' : 'auto',
                  flex: filteredLicenses.length === 0 ? 1 : 'none'
                }}
              >
                <thead>
                  <tr style={{ background: '#1e1b4b' }}>
                    {[
                      'Licence ID', 'Vehicle ID', 'Vehicle Name',
                      'Device IMEI', 'Organization', 'Licence Issued', 'Licence Expiry',
                      'Plan Duration', 'Renewal Price', 'Discount Price', 'Status', 'Action'
                    ].map(h => (
                      <th key={h} style={{ padding: '12px 20px', fontSize: '12px', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ height: filteredLicenses.length === 0 ? '100%' : 'auto' }}>
                  {filteredLicenses.length === 0 ? (
                    <tr style={{ height: '100%' }}>
                      <td colSpan="12" style={{ height: '100%', padding: '40px 20px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', transform: 'translateX(-120px)', opacity: 0.7 }}>
                          <CalendarX2 size={48} color="#94A3B8" style={{ marginBottom: '16px' }} />
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                            {statusFilter !== 'all' ? `No ${statusFilter.toLowerCase()} vehicle licenses found` : 'No vehicle licenses found'}
                          </div>
                          {statusFilter !== 'all' && (
                            <button
                              onClick={() => setStatusFilter('all')}
                              style={{ marginTop: '8px', fontSize: '13px', color: '#f97316', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                            >
                              Show all ({licenses.length}) licenses
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : paginatedLicenses.map((l, index) => {
                    const isExp = l.status === 'Expired';
                    const isExpiring = l.status === 'Expiring';
                    const planLabel = l.durationMonths === 12
                      ? `1 Year Plan (${l.thresholdDays || 7}d alert)`
                      : (l.durationMonths === 1
                        ? `1 Month Plan (${l.thresholdDays || 7}d alert)`
                        : `${l.durationMonths} Mo Plan (${l.thresholdDays || 7}d alert)`);

                    return (
                      <tr
                        key={(l.dbVehicleId || l.vehicleId) + index}
                        style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '16px 20px', fontSize: '13px', fontFamily: 'monospace', color: '#64748B' }}>{l.licenceId}</td>
                        <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{l.vehicleId}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 700, color: '#111827' }}>{l.vehicleName}</td>
                        <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569', fontFamily: 'monospace' }}>
                          <div>{l.deviceId}</div>
                          {l.gpsSimNo1 && l.gpsSimNo1 !== '-' && (
                            <div style={{ fontSize: '11px', color: '#0284C7', fontWeight: 600 }}>SIM: {l.gpsSimNo1}</div>
                          )}
                        </td>
                        <td style={{ padding: '16px 20px', fontSize: '13px', color: '#111827' }}>
                          <div style={{ fontWeight: 600 }}>{l.organization}</div>
                          {l.customerName && l.customerName !== '-' && (
                            <div style={{ fontSize: '11px', color: '#64748B' }}>
                              {l.customerName}{l.phone && l.phone !== '-' ? ` • ${l.phone}` : ''}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>{formatDate(l.licenceIssuedDate)}</td>
                        <td style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 700, color: isExp ? '#DC2626' : isExpiring ? '#D97706' : '#111827' }}>
                          {formatDate(l.licenceExpiryDate)}
                        </td>

                        <td style={{ padding: '16px 20px', fontSize: '12px', color: '#475569' }}>
                          <span style={{ background: '#F1F5F9', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}>
                            {planLabel}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                          {l.renewalPrice !== null && l.renewalPrice !== undefined ? `₹${parseFloat(l.renewalPrice).toFixed(2)}` : <span style={{ color: '#94A3B8', fontSize: '12px' }}>Not Set</span>}
                        </td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 800, color: '#059669' }}>
                          {l.discountPrice !== null && l.discountPrice !== undefined ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span>₹{parseFloat(l.discountPrice).toFixed(2)}</span>
                              {l.renewalPrice && parseFloat(l.renewalPrice) > parseFloat(l.discountPrice) && (
                                <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                                  Save ₹{(parseFloat(l.renewalPrice) - parseFloat(l.discountPrice)).toFixed(2)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#94A3B8', fontSize: '12px', fontWeight: 500 }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span
                            onClick={() => openSetAmountModal(l)}
                            title="Click to set renewal amount & duration"
                            style={{
                              padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, cursor: 'pointer',
                              background: isExp ? '#FEE2E2' : isExpiring ? '#FEF3C7' : '#D1FAE5',
                              color: isExp ? '#DC2626' : isExpiring ? '#D97706' : '#059669',
                              border: `1px solid ${isExp ? '#FECACA' : isExpiring ? '#FDE68A' : '#A7F3D0'}`,
                              display: 'inline-flex', alignItems: 'center', gap: '6px'
                            }}
                          >
                            {isExp ? 'EXPIRED' : isExpiring ? `EXPIRING (${l.diffDays}d left)` : 'ACTIVE'}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <button
                            onClick={() => openSetAmountModal(l)}
                            style={{
                              padding: '6px 14px', background: '#F97316', color: '#FFFFFF',
                              border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '12px',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                              boxShadow: '0 2px 4px rgba(249, 115, 22, 0.2)'
                            }}
                          >
                            <Edit3 size={14} />
                            Set Amount
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* TAB 2: TRANSACTION HISTORY */
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <table
                className="pastel-table"
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                  height: filteredTransactions.length === 0 ? '100%' : 'auto',
                  flex: filteredTransactions.length === 0 ? 1 : 'none'
                }}
              >
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    {[
                      'Transaction / Payment ID', 'Payment Time', 'Vehicle',
                      'User Name & Email', 'Duration', 'Amount Paid', 'Status'
                    ].map(h => (
                      <th key={h} style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ height: filteredTransactions.length === 0 ? '100%' : 'auto' }}>
                  {filteredTransactions.length === 0 ? (
                    <tr style={{ height: '100%' }}>
                      <td colSpan="7" style={{ height: '100%', padding: '40px 20px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
                          <Clock size={48} color="#94A3B8" style={{ marginBottom: '16px' }} />
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>No renewal transactions yet</div>
                          <div style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>Transactions will appear here when users renew licenses.</div>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedTransactions.map((t) => (
                    <tr
                      key={t.id || t.payment_id}
                      style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '16px 20px', fontSize: '13px', fontFamily: 'monospace', fontWeight: 700, color: '#2563EB' }}>
                        {t.payment_id}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>
                        {formatLocalTime(t.created_at)}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                        {t.vehicle_name}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#111827' }}>
                        <div style={{ fontWeight: 600 }}>{t.user_name}</div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>{t.user_email}</div>
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>
                        {t.duration_months} Months
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '15px', fontWeight: 800, color: '#059669' }}>
                        ₹{parseFloat(t.amount).toFixed(2)}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 800,
                          background: '#D1FAE5', color: '#059669', border: '1px solid #A7F3D0',
                          display: 'inline-flex', alignItems: 'center', gap: '4px'
                        }}>
                          <CheckCircle size={14} />
                          {t.status || 'SUCCESS'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer bar with Showing info and Pagination */}
          {!loading && !error && currentList.length > 0 && (
            <div style={{
              padding: '10px 20px',
              background: '#ffffff',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              flexShrink: 0
            }}>
              {/* Left: Showing info */}
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                <span>
                  Showing <strong style={{ color: '#0f172a' }}>{startIndex + 1}</strong> to{' '}
                  <strong style={{ color: '#0f172a' }}>{Math.min(startIndex + pageSize, currentList.length)}</strong> of{' '}
                  <strong style={{ color: '#0f172a' }}>{currentList.length}</strong> entries
                </span>
              </div>

              {/* Right: Page Numbers matching FuelTracks UI theme */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {/* Previous page button */}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={activePage === 1}
                    aria-label="Previous page"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: 'none',
                      background: 'transparent',
                      color: activePage === 1 ? '#cbd5e1' : '#475569',
                      cursor: activePage === 1 ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => {
                      if (activePage !== 1) {
                        e.currentTarget.style.background = '#f1f5f9';
                        e.currentTarget.style.color = '#0f172a';
                      }
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = activePage === 1 ? '#cbd5e1' : '#475569';
                    }}
                  >
                    <ChevronLeft size={18} strokeWidth={2.5} />
                  </button>

                  {/* Page numbers */}
                  {getPageNumbers().map((item, i) => {
                    if (item === '...') {
                      return (
                        <span
                          key={`ellipsis-${i}`}
                          style={{
                            width: '28px',
                            textAlign: 'center',
                            color: '#94a3b8',
                            fontSize: '14px',
                            userSelect: 'none'
                          }}
                        >
                          …
                        </span>
                      );
                    }

                    const isActive = item === activePage;
                    return (
                      <button
                        type="button"
                        key={item}
                        onClick={() => setCurrentPage(item)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '13px',
                          fontWeight: isActive ? 700 : 600,
                          color: isActive ? '#ffffff' : '#475569',
                          background: isActive ? '#1e1b4b' : 'transparent',
                          cursor: isActive ? 'default' : 'pointer',
                          transition: 'all 0.15s',
                          boxShadow: isActive ? '0 2px 4px rgba(30, 27, 75, 0.25)' : 'none'
                        }}
                        onMouseEnter={e => {
                          if (!isActive) {
                            e.currentTarget.style.background = '#f1f5f9';
                            e.currentTarget.style.color = '#0f172a';
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#475569';
                          }
                        }}
                      >
                        {item}
                      </button>
                    );
                  })}

                  {/* Next page button */}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={activePage === totalPages}
                    aria-label="Next page"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: 'none',
                      background: 'transparent',
                      color: activePage === totalPages ? '#cbd5e1' : '#475569',
                      cursor: activePage === totalPages ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => {
                      if (activePage !== totalPages) {
                        e.currentTarget.style.background = '#f1f5f9';
                        e.currentTarget.style.color = '#0f172a';
                      }
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = activePage === totalPages ? '#cbd5e1' : '#475569';
                    }}
                  >
                    <ChevronRight size={18} strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Set Renewal Amount Modal */}
      <SetRenewalAmountModal
        isOpen={isAmountModalOpen}
        onClose={() => {
          setIsAmountModalOpen(false);
          setSelectedVehicleForAmount(null);
        }}
        vehicle={selectedVehicleForAmount}
        onSuccess={handleSetAmountSuccess}
      />
    </div>
  );
};

export default BillingAdminPage;
