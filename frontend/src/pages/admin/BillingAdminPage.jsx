import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { formatLocalDate, formatLocalTime } from '../../utils/dateUtils';
import {
  Loader2, ArrowLeft, AlertTriangle, Search, FileText, CalendarX2, CreditCard,
  DollarSign, Edit3, Clock, CheckCircle, Settings, Download, ChevronDown, ChevronLeft,
  ChevronRight, CheckCircle2, RotateCw, Layers, ShieldCheck, RefreshCw, Filter, X
} from 'lucide-react';
import * as adminApi from '../../api/adminApi';
import SetRenewalAmountModal from '../../components/modals/SetRenewalAmountModal';
import { getVehicleLicenseTier } from '../../utils/licenseUtils';

const BillingAdminPage = () => {
  const navigate = useNavigate();

  // 4 Primary Tabs + Transactions
  // 'licenses' | 'renew' | 'pre-renewed' | 'expired' | 'transactions'
  const [activeTab, setActiveTab] = useState('licenses');

  const [licenses, setLicenses] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState('all'); // 'all' | 'Standard' | 'Standard Pro' | 'Advanced' | 'Premium'
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
    if (activeTab === 'transactions') {
      fetchTransactions();
    } else {
      fetchLicenses();
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
    if (!dateStr) return null;
    return formatLocalDate(dateStr);
  };

  // Helper to render subtle gray em-dash for empty values
  const renderEmptyDash = (val) => {
    if (!val || val === '-' || val === '—') {
      return <span style={{ color: '#94a3b8', fontWeight: 400 }}>—</span>;
    }
    return val;
  };

  // Helper to determine display tier name - Standard, Standard Pro, Advanced, Premium
  const getDisplayTier = (l) => {
    if (!l) return 'Standard';
    const tier = getVehicleLicenseTier(l);
    if (tier === 'Standard Pro') return 'Standard Pro';
    if (tier === 'Standard') return 'Standard';
    if (tier === 'Advanced') return 'Advanced';
    if (tier === 'Premium') return 'Premium';

    const raw = String(l.licenceType || l.metadata?.licenceType || '').trim().toLowerCase();
    if (raw.includes('starter') || raw.includes('standard pro') || raw.includes('pro')) return 'Standard Pro';
    if (raw.includes('basic') || raw.includes('standard')) return 'Standard';
    if (raw.includes('advance')) return 'Advanced';
    if (raw.includes('premium') || raw.includes('enterprise')) return 'Premium';

    return 'Standard';
  };

  // Tier counts calculation for FuelTracks 4 official license tiers
  const tierCounts = useMemo(() => {
    const counts = { 'Standard': 0, 'Standard Pro': 0, 'Advanced': 0, 'Premium': 0 };
    licenses.forEach(l => {
      const tier = getDisplayTier(l);
      if (counts[tier] !== undefined) {
        counts[tier]++;
      } else {
        counts['Standard']++;
      }
    });
    return counts;
  }, [licenses]);

  // Tab categorization lists
  // 1. All Licenses
  const allLicensesList = licenses;

  // 2. Renew (Expiring soon within 30 days or status is Expiring - requires active expiry date)
  const renewLicensesList = useMemo(() => {
    return licenses.filter(l => {
      if (!l.licenceExpiryDate) return false;
      if (l.status === 'Expiring') return true;
      if (l.diffDays !== null && l.diffDays !== undefined) {
        return l.diffDays >= 0 && l.diffDays <= 30;
      }
      return false;
    });
  }, [licenses]);

  // 3. Pre-Renewed (Active licenses with valid expiry date and >30 days remaining)
  const preRenewedLicensesList = useMemo(() => {
    return licenses.filter(l => {
      if (!l.licenceExpiryDate) return false;
      if (l.status === 'Active') {
        if (l.diffDays !== null && l.diffDays !== undefined) {
          return l.diffDays > 30;
        }
        return true;
      }
      return false;
    });
  }, [licenses]);

  // 4. Expired (diffDays < 0 or status is Expired - requires active expiry date)
  const expiredLicensesList = useMemo(() => {
    return licenses.filter(l => {
      if (!l.licenceExpiryDate) return false;
      if (l.status === 'Expired') return true;
      if (l.diffDays !== null && l.diffDays !== undefined) {
        return l.diffDays < 0;
      }
      return false;
    });
  }, [licenses]);

  // Determine current active dataset based on activeTab
  const currentTabList = useMemo(() => {
    switch (activeTab) {
      case 'renew':
        return renewLicensesList;
      case 'pre-renewed':
        return preRenewedLicensesList;
      case 'expired':
        return expiredLicensesList;
      case 'licenses':
      default:
        return allLicensesList;
    }
  }, [activeTab, allLicensesList, renewLicensesList, preRenewedLicensesList, expiredLicensesList]);

  // Filtered by Search & Tier
  const filteredLicenses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return currentTabList.filter(l => {
      const matchesSearch = !q ||
        (l.vehicleName || '').toLowerCase().includes(q) ||
        (l.vehicleId || '').toLowerCase().includes(q) ||
        (l.deviceId || '').toLowerCase().includes(q) ||
        (l.licenceId || '').toLowerCase().includes(q) ||
        (l.organization || '').toLowerCase().includes(q) ||
        (l.dealerName || '').toLowerCase().includes(q) ||
        (l.customerName || '').toLowerCase().includes(q) ||
        (l.phone || '').toLowerCase().includes(q) ||
        (l.gpsSimNo || '').toLowerCase().includes(q) ||
        (l.gpsSimNo1 || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (selectedTier !== 'all') {
        const dTier = getDisplayTier(l);
        if (dTier.toLowerCase() !== selectedTier.toLowerCase()) return false;
      }

      return true;
    });
  }, [currentTabList, searchQuery, selectedTier]);

  const filteredTransactions = transactions.filter(t => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (t.payment_id || '').toLowerCase().includes(q) ||
      (t.vehicle_name || '').toLowerCase().includes(q) ||
      (t.user_name || '').toLowerCase().includes(q) ||
      (t.user_email || '').toLowerCase().includes(q)
    );
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, selectedTier]);

  const currentList = activeTab === 'transactions' ? filteredTransactions : filteredLicenses;
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

  const activeCount = licenses.filter(l => l.status === 'Active').length;
  const expiringCount = licenses.filter(l => l.status === 'Expiring' || (l.licenceExpiryDate && l.diffDays !== null && l.diffDays >= 0 && l.diffDays <= 30)).length;
  const expiredCount = licenses.filter(l => l.status === 'Expired' || (l.licenceExpiryDate && l.diffDays !== null && l.diffDays < 0)).length;

  const handleExportExcel = (filterType = 'all') => {
    let exportList = licenses;
    let typeName = 'All';

    if (filterType === 'Active') {
      exportList = licenses.filter(l => l.status === 'Active');
      typeName = 'Active';
    } else if (filterType === 'Expiring') {
      exportList = licenses.filter(l => l.status === 'Expiring' || (l.licenceExpiryDate && l.diffDays !== null && l.diffDays >= 0 && l.diffDays <= 30));
      typeName = 'Expiring';
    } else if (filterType === 'Expired') {
      exportList = licenses.filter(l => l.status === 'Expired' || (l.licenceExpiryDate && l.diffDays !== null && l.diffDays < 0));
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
        'Licence Issued Date': issuedDate,
        'Licence Expiry Date': expiryDate,
        'Status': item.status || '-',
        'Days Status': daysStatus,
        'Plan Duration': item.durationMonths ? `${item.durationMonths} Month(s)` : '-',
        'Alert Threshold (Days)': item.thresholdDays || 7,
        'Renewal Price (₹)': item.renewalPrice !== null && item.renewalPrice !== undefined ? item.renewalPrice : '-',
        'Discount Price (₹)': item.discountPrice !== null && item.discountPrice !== undefined ? item.discountPrice : '-'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Vehicle Licenses');
    XLSX.writeFile(workbook, `FuelTracks_Licenses_${typeName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="pastel-page-bg" style={{ padding: '16px 20px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: 'auto' }}>

      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 shrink-0">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#94A3B8'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
            title="Go Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>
              <span>Fleet Management</span>
              <ChevronRight size={12} />
              <span style={{ color: '#ea580c' }}>Billing & Subscriptions</span>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={22} color="#f97316" />
              Billing & Subscriptions
            </h1>
          </div>
        </div>

        {/* 4 Main Tabs: Licenses, Renew, Pre-Renewed, Expired (+ Transactions) */}
        <div style={{
          display: 'flex',
          gap: '3px',
          background: '#f1f5f9',
          padding: '3px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          flexWrap: 'nowrap'
        }}>
          {[
            { id: 'licenses', label: 'Licenses', count: allLicensesList.length, icon: CreditCard },
            { id: 'renew', label: 'Renew', count: renewLicensesList.length, icon: RotateCw },
            { id: 'pre-renewed', label: 'Pre-Renewed', count: preRenewedLicensesList.length, icon: CheckCircle2 },
            { id: 'expired', label: 'Expired', count: expiredLicensesList.length, icon: CalendarX2 },
            { id: 'transactions', label: 'Transactions', count: transactions.length, icon: Clock }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearchQuery('');
                  setSelectedTier('all');
                }}
                style={{
                  padding: '5px 11px',
                  borderRadius: '7px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  background: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? '#0f172a' : '#64748b',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.07)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                <tab.icon size={13} color={isActive ? '#f97316' : '#64748b'} />
                <span>{tab.label}</span>
                <span style={{
                  fontSize: '10.5px',
                  fontWeight: 800,
                  padding: '1px 5px',
                  borderRadius: '5px',
                  background: isActive ? '#fff7ed' : '#e2e8f0',
                  color: isActive ? '#ea580c' : '#475569'
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* FuelTracks Total Licenses by Tier Metric Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: '11px',
        border: '1px solid #e2e8f0',
        padding: '10px 16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        marginBottom: '10px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Licenses by Tier
            </span>
            {selectedTier !== 'all' && (
              <button
                onClick={() => setSelectedTier('all')}
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#ea580c',
                  background: '#fff7ed',
                  border: '1px solid #ffedd5',
                  borderRadius: '4px',
                  padding: '1px 6px',
                  cursor: 'pointer'
                }}
              >
                Clear Filter ({selectedTier}) ✕
              </button>
            )}
          </div>
          <span style={{
            background: '#fff7ed',
            color: '#ea580c',
            fontSize: '11px',
            fontWeight: 800,
            padding: '1px 8px',
            borderRadius: '5px',
            border: '1px solid #ffedd5'
          }}>
            {licenses.length} Total Registered
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {[
            { name: 'Standard', count: tierCounts['Standard'], color: '#059669', border: '#a7f3d0' },
            { name: 'Standard Pro', count: tierCounts['Standard Pro'], color: '#0284c7', border: '#bae6fd' },
            { name: 'Advanced', count: tierCounts['Advanced'], color: '#d97706', border: '#fde68a' },
            { name: 'Premium', count: tierCounts['Premium'], color: '#7c3aed', border: '#ddd6fe' }
          ].map(tier => {
            const isSelected = selectedTier === tier.name;

            return (
              <div
                key={tier.name}
                onClick={() => setSelectedTier(isSelected ? 'all' : tier.name)}
                style={{
                  background: isSelected ? tier.color : '#ffffff',
                  color: isSelected ? '#ffffff' : '#000000',
                  borderRadius: '7px',
                  padding: '6px 10px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  border: `1.5px solid ${isSelected ? tier.color : '#cbd5e1'}`,
                  transition: 'all 0.15s ease'
                }}
                title={`Filter table by ${tier.name}`}
              >
                <div style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: isSelected ? '#ffffff' : '#000000',
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em'
                }}>
                  {tier.name}
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 900,
                  color: isSelected ? '#ffffff' : '#000000',
                  marginTop: '2px'
                }}>
                  {tier.count}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Table Card */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        flex: '1',
        overflow: 'hidden'
      }}>

        {/* Toolbar: Search & Clean Export Button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-2.5 sm:px-4 border-b border-slate-200">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '420px' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
              <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} size={15} />
              <input
                type="text"
                placeholder={activeTab === 'transactions' ? "Search transaction ID, vehicle, user..." : "Search by licence, vehicle, IMEI, SIM, org..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 30px 7px 34px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12.5px',
                  outline: 'none',
                  color: '#111827',
                  boxSizing: 'border-box'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    padding: '2px'
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Action buttons (Reset & Styled Export Button) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {selectedTier !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedTier('all')}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                Reset Tier: {selectedTier} ✕
              </button>
            )}

            {activeTab !== 'transactions' && (
              <div ref={exportDropdownRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    background: '#10B981',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(16, 185, 129, 0.3)',
                    transition: 'background 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#059669'}
                  onMouseLeave={e => e.currentTarget.style.background = '#10B981'}
                >
                  <Download size={14} />
                  <span>Export Excel</span>
                  <ChevronDown size={14} style={{ transform: exportDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>

                {exportDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      marginTop: '6px',
                      background: '#FFFFFF',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                      width: '230px',
                      padding: '6px 0',
                      zIndex: 60
                    }}
                  >
                    <div style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      DOWNLOAD OPTIONS
                    </div>

                    <button
                      type="button"
                      onClick={() => { handleExportExcel('all'); setExportDropdownOpen(false); }}
                      style={{
                        width: '100%',
                        padding: '8px 14px',
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#334155',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
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
                      type="button"
                      onClick={() => { handleExportExcel('Active'); setExportDropdownOpen(false); }}
                      style={{
                        width: '100%',
                        padding: '8px 14px',
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#047857',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
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
                      type="button"
                      onClick={() => { handleExportExcel('Expiring'); setExportDropdownOpen(false); }}
                      style={{
                        width: '100%',
                        padding: '8px 14px',
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#B45309',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
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
                      type="button"
                      onClick={() => { handleExportExcel('Expired'); setExportDropdownOpen(false); }}
                      style={{
                        width: '100%',
                        padding: '8px 14px',
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#B91C1C',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
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
            )}
          </div>
        </div>

        {/* Loading or Error State */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '300px' }}>
            <Loader2 size={32} color="#f97316" className="animate-spin" />
            <span style={{ fontSize: '14px', color: '#6B7280', marginTop: '12px' }}>Loading billing data...</span>
          </div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center', flex: 1 }}>
            <AlertTriangle size={32} color="#EF4444" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Failed to Load Records</div>
            <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>{error}</div>
          </div>
        ) : activeTab !== 'transactions' ? (
          /* ============================================================ */
          /* LICENSES / RENEW / PRE-RENEWED / EXPIRED TABLE               */
          /* ============================================================ */
          <div style={{
            overflowX: 'auto',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            paddingBottom: '16px'
          }}>
            <table
              className="pastel-table"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                whiteSpace: 'nowrap',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                height: filteredLicenses.length === 0 ? '100%' : 'auto',
                flex: filteredLicenses.length === 0 ? 1 : 'none'
              }}
            >
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ background: 'var(--brand-header, #1e1b4b)' }}>
                  {[
                    'Licence ID', 'Vehicle ID', 'Vehicle Name',
                    'Device IMEI', 'Organization', 'Licence Issued', 'Licence Expiry',
                    'Plan Duration', 'Renewal Price', 'Discount Price', 'Status', 'Action'
                  ].map((h, i, arr) => (
                    <th key={h} style={{
                      padding: '8px 10px',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      color: '#ffffff',
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                      borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.2)' : 'none',
                      textAlign: h === 'Action' ? 'center' : 'left'
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ height: filteredLicenses.length === 0 ? '100%' : 'auto' }}>
                {filteredLicenses.length === 0 ? (
                  <tr style={{ height: '100%' }}>
                    <td colSpan="12" style={{ height: '100%', padding: '40px 20px', textAlign: 'center', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.7 }}>
                        <CalendarX2 size={44} color="#94A3B8" style={{ marginBottom: '14px' }} />
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                          No {activeTab} licenses found
                        </div>
                        {selectedTier !== 'all' && (
                          <button
                            type="button"
                            onClick={() => setSelectedTier('all')}
                            style={{ marginTop: '8px', fontSize: '13px', color: '#f97316', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                          >
                            Reset tier filter
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : paginatedLicenses.map((l, index) => {
                  const hasExpiry = Boolean(l.licenceExpiryDate);
                  const isExp = hasExpiry && (l.status === 'Expired' || (l.diffDays !== null && l.diffDays < 0));
                  const isExpiring = hasExpiry && (l.status === 'Expiring' || (l.diffDays !== null && l.diffDays >= 0 && l.diffDays <= 30));
                  const planLabel = l.durationMonths === 12
                    ? `1 Year Plan (${l.thresholdDays || 7}d alert)`
                    : (l.durationMonths === 1
                      ? `1 Month Plan (${l.thresholdDays || 7}d alert)`
                      : `${l.durationMonths || 1} Mo Plan (${l.thresholdDays || 7}d alert)`);

                  return (
                    <tr
                      key={(l.dbVehicleId || l.vehicleId || index) + '-' + index}
                      style={{ borderBottom: '1px solid #e0e7ff', height: '38px', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Licence ID */}
                      <td style={{ padding: '6px 10px', fontSize: '12.5px', fontFamily: 'monospace', color: '#000000', fontWeight: 700, verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>
                        {renderEmptyDash(l.licenceId)}
                      </td>

                      {/* Vehicle ID */}
                      <td style={{ padding: '6px 10px', fontSize: '12.5px', color: '#000000', fontWeight: 600, verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>
                        {renderEmptyDash(l.vehicleId)}
                      </td>

                      {/* Vehicle Name */}
                      <td style={{ padding: '6px 10px', fontSize: '12.5px', fontWeight: 700, color: '#000000', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>
                        {l.vehicleName}
                      </td>

                      {/* Device IMEI */}
                      <td style={{ padding: '6px 10px', fontSize: '12.5px', color: '#000000', fontFamily: 'monospace', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>
                        <div>{l.deviceId}</div>
                        {l.gpsSimNo1 && l.gpsSimNo1 !== '-' && (
                          <div style={{ fontSize: '11px', color: '#0284C7', fontWeight: 600 }}>SIM: {l.gpsSimNo1}</div>
                        )}
                      </td>

                      {/* Organization */}
                      <td style={{ padding: '6px 10px', fontSize: '12.5px', color: '#000000', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: 700 }}>{l.organization}</div>
                        {l.customerName && l.customerName !== '-' && (
                          <div style={{ fontSize: '11px', color: '#64748B' }}>
                            {l.customerName}{l.phone && l.phone !== '-' ? ` • ${l.phone}` : ''}
                          </div>
                        )}
                      </td>

                      {/* Licence Issued */}
                      <td style={{ padding: '6px 10px', fontSize: '12.5px', color: '#000000', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>
                        {formatDate(l.licenceIssuedDate) || renderEmptyDash(null)}
                      </td>

                      {/* Licence Expiry */}
                      <td style={{
                        padding: '6px 10px',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        color: isExp ? '#DC2626' : isExpiring ? '#D97706' : '#000000',
                        verticalAlign: 'middle',
                        borderRight: '1px solid #e2e8f0'
                      }}>
                        {formatDate(l.licenceExpiryDate) || renderEmptyDash(null)}
                      </td>

                      {/* Plan Duration */}
                      <td style={{ padding: '6px 10px', fontSize: '12px', color: '#000000', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>
                        <span style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          {planLabel}
                        </span>
                      </td>

                      {/* Renewal Price */}
                      <td style={{ padding: '6px 10px', fontSize: '12.5px', fontWeight: 800, color: '#000000', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>
                        {l.renewalPrice !== null && l.renewalPrice !== undefined ? (
                          `₹${parseFloat(l.renewalPrice).toFixed(2)}`
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: '12px' }}>Not Set</span>
                        )}
                      </td>

                      {/* Discount Price */}
                      <td style={{ padding: '6px 10px', fontSize: '12.5px', fontWeight: 800, color: '#059669', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>
                        {l.discountPrice !== null && l.discountPrice !== undefined ? (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>₹{parseFloat(l.discountPrice).toFixed(2)}</span>
                            {l.renewalPrice && parseFloat(l.renewalPrice) > parseFloat(l.discountPrice) && (
                              <span style={{ fontSize: '10.5px', color: '#059669', fontWeight: 700 }}>
                                Save ₹{(parseFloat(l.renewalPrice) - parseFloat(l.discountPrice)).toFixed(2)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: '12px', fontWeight: 500 }}>—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '6px 10px', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>
                        {!hasExpiry ? (
                          <span
                            onClick={() => openSetAmountModal(l)}
                            title="Click to set expiry date and plan"
                            style={{
                              padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                              background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1',
                              display: 'inline-flex', alignItems: 'center', gap: '4px'
                            }}
                          >
                            SETUP NEEDED
                          </span>
                        ) : (
                          <span
                            onClick={() => openSetAmountModal(l)}
                            title="Click to set renewal amount & duration"
                            style={{
                              padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                              background: isExp ? '#FEE2E2' : isExpiring ? '#FEF3C7' : '#D1FAE5',
                              color: isExp ? '#DC2626' : isExpiring ? '#D97706' : '#059669',
                              border: `1px solid ${isExp ? '#FECACA' : isExpiring ? '#FDE68A' : '#A7F3D0'}`,
                              display: 'inline-flex', alignItems: 'center', gap: '4px'
                            }}
                          >
                            {isExp ? 'EXPIRED' : isExpiring ? `EXPIRING (${l.diffDays}d left)` : 'ACTIVE'}
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '6px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <button
                          type="button"
                          onClick={() => openSetAmountModal(l)}
                          style={{
                            padding: '3px 8px', background: '#F97316', color: '#FFFFFF',
                            border: 'none', borderRadius: '4px', fontWeight: 700, fontSize: '11.5px',
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
                            boxShadow: '0 1px 3px rgba(249, 115, 22, 0.2)'
                          }}
                        >
                          <Edit3 size={11} />
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
          /* ============================================================ */
          /* TRANSACTIONS TABLE                                           */
          /* ============================================================ */
          <div style={{
            overflowX: 'auto',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            paddingBottom: '16px'
          }}>
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
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ background: 'var(--brand-header, #1e1b4b)' }}>
                  {[
                    'Transaction / Payment ID', 'Payment Time', 'Vehicle',
                    'User Name & Email', 'Duration', 'Amount Paid', 'Status'
                  ].map((h, i, arr) => (
                    <th key={h} style={{
                      padding: '9px 12px',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      color: '#ffffff',
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                      borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.2)' : 'none'
                    }}>
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
                        <Clock size={44} color="#94A3B8" style={{ marginBottom: '14px' }} />
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#000000' }}>No renewal transactions yet</div>
                        <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>Transactions will appear here when users renew licenses.</div>
                      </div>
                    </td>
                  </tr>
                ) : paginatedTransactions.map((t) => (
                  <tr
                    key={t.id || t.payment_id}
                    style={{ borderBottom: '1px solid #e0e7ff', height: '42px', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '6px 12px', fontSize: '12.5px', fontFamily: 'monospace', fontWeight: 700, color: '#000000', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>
                      {t.payment_id}
                    </td>
                    <td style={{ padding: '6px 12px', fontSize: '12.5px', color: '#000000', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>
                      {formatLocalTime(t.created_at)}
                    </td>
                    <td style={{ padding: '6px 12px', fontSize: '12.5px', fontWeight: 700, color: '#000000', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>
                      {t.vehicle_name}
                    </td>
                    <td style={{ padding: '6px 12px', fontSize: '12.5px', color: '#000000', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: 700 }}>{t.user_name}</div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>{t.user_email}</div>
                    </td>
                    <td style={{ padding: '6px 12px', fontSize: '12.5px', color: '#000000', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>
                      {t.duration_months} Months
                    </td>
                    <td style={{ padding: '6px 12px', fontSize: '12.5px', fontWeight: 800, color: '#059669', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0' }}>
                      ₹{parseFloat(t.amount).toFixed(2)}
                    </td>
                    <td style={{ padding: '6px 12px', verticalAlign: 'middle' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 800,
                        background: '#D1FAE5',
                        color: '#059669',
                        border: '1px solid #A7F3D0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}>
                        <CheckCircle size={12} />
                        {t.status || 'SUCCESS'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Bar with Showing info and Pagination */}
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
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              <span>
                Showing <strong style={{ color: '#0f172a' }}>{startIndex + 1}</strong> to{' '}
                <strong style={{ color: '#0f172a' }}>{Math.min(startIndex + pageSize, currentList.length)}</strong> of{' '}
                <strong style={{ color: '#0f172a' }}>{currentList.length}</strong> entries
              </span>
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
