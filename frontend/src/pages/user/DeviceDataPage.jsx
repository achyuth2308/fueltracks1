import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Cpu, Search, RefreshCw, ChevronLeft, ChevronRight, Copy, Check,
  Download, FileSpreadsheet, Loader2, ArrowLeft, Filter, Calendar, Clock,
  Truck, ShieldCheck, CheckCircle2, ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import axiosInstance from '../../api/axios';
import TelematicsDatePicker from '../../components/ui/TelematicsDatePicker';
import TelematicsTimePicker from '../../components/ui/TelematicsTimePicker';

// Format time as "HH:mm:ss DD-MM-YYYY" matching legacy fuelProtocol
function formatLegacyDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

// Format fallback protocol message if raw packet is not populated
function formatDeviceMessage(m) {
  if (m.raw && typeof m.raw === 'string' && m.raw.trim().length > 0) {
    return m.raw.trim();
  }
  const d = m.device_time ? new Date(m.device_time) : (m.received_at ? new Date(m.received_at) : new Date());
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  const dmy = `${pad(d.getDate())}${pad(d.getMonth() + 1)}${String(d.getFullYear()).slice(-2)}`;
  const hms = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

  const latVal = Math.abs(parseFloat(m.lat) || 0);
  const latDeg = Math.floor(latVal);
  const latMin = ((latVal - latDeg) * 60).toFixed(4);
  const latStr = `${pad(latDeg, 2)}${pad(latMin, 7)}`;
  const latDir = (parseFloat(m.lat) || 0) >= 0 ? 'N' : 'S';

  const lngVal = Math.abs(parseFloat(m.lng) || 0);
  const lngDeg = Math.floor(lngVal);
  const lngMin = ((lngVal - lngDeg) * 60).toFixed(4);
  const lngStr = `${pad(lngDeg, 3)}${pad(lngMin, 7)}`;
  const lngDir = (parseFloat(m.lng) || 0) >= 0 ? 'E' : 'W';

  const speed = Math.round(parseFloat(m.speed) || 0);
  const odo = Math.round(parseFloat(m.odometer) || 0);
  const fuel = (parseFloat(m.fuel) || 0).toFixed(2);
  const volt = (parseFloat(m.voltage) || 24).toFixed(2);
  const ign = (m.ignition === true || m.ignition === 1 || m.ignition === '1') ? '1' : '0';

  return `$10,${m.imei || 'DEVICE'},A,${dmy},${hms},${latStr},${latDir},${lngStr},${lngDir},${speed},${odo},105,37,31,${ign},1,0,0,1,02,02,${pad(fuel, 7)},${volt},L`;
}

export default function DeviceDataPage() {
  const { id: urlVehicleId } = useParams();
  const navigate = useNavigate();

  // Fleet state
  const [vehicles, setVehicles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [loadingFleet, setLoadingFleet] = useState(true);

  // Date & Time filter state (Default: Today 00:00 to 23:59)
  const now = useMemo(() => new Date(), []);
  const pad = (n) => String(n).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');
  const [activePreset, setActivePreset] = useState('today');

  // Packets state
  const [packets, setPackets] = useState([]);
  const [loadingPackets, setLoadingPackets] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Quick Preset Handlers
  const handlePresetSelect = (preset) => {
    setActivePreset(preset);
    const curr = new Date();
    const currDateStr = `${curr.getFullYear()}-${pad(curr.getMonth() + 1)}-${pad(curr.getDate())}`;

    if (preset === 'today') {
      setStartDate(currDateStr);
      setEndDate(currDateStr);
      setStartTime('00:00');
      setEndTime('23:59');
    } else if (preset === 'yesterday') {
      const y = new Date(curr.getTime() - 24 * 60 * 60 * 1000);
      const yDateStr = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
      setStartDate(yDateStr);
      setEndDate(yDateStr);
      setStartTime('00:00');
      setEndTime('23:59');
    } else if (preset === 'last24h') {
      const y = new Date(curr.getTime() - 24 * 60 * 60 * 1000);
      const yDateStr = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
      const hhmm = `${pad(curr.getHours())}:${pad(curr.getMinutes())}`;
      setStartDate(yDateStr);
      setEndDate(currDateStr);
      setStartTime(hhmm);
      setEndTime(hhmm);
    }
  };

  // 1. Load Vehicles & Groups
  useEffect(() => {
    let isMounted = true;
    async function loadFleet() {
      try {
        setLoadingFleet(true);
        const [vRes, gRes] = await Promise.all([
          axiosInstance.get('/api/vehicles'),
          axiosInstance.get('/api/admin/groups')
        ]);
        if (!isMounted) return;

        const vList = Array.isArray(vRes.data?.data) ? vRes.data.data : (Array.isArray(vRes.data) ? vRes.data : []);
        const gList = Array.isArray(gRes.data?.data) ? gRes.data.data : (Array.isArray(gRes.data) ? gRes.data : []);

        setVehicles(vList);
        setGroups(gList);

        if (vList.length > 0) {
          const matched = urlVehicleId
            ? vList.find(v => String(v.id) === String(urlVehicleId) || v.imei === urlVehicleId)
            : vList[0];
          setSelectedVehicle(matched || vList[0]);
        }
      } catch (err) {
        console.error('Failed to load vehicles for Device Data:', err);
      } finally {
        if (isMounted) setLoadingFleet(false);
      }
    }
    loadFleet();
    return () => { isMounted = false; };
  }, [urlVehicleId]);

  // 2. Fetch Packets
  const fetchPackets = useCallback(async (targetPage = 1, customLimit = limit) => {
    if (!selectedVehicle?.id && !selectedVehicle?.imei) return;
    setLoadingPackets(true);
    try {
      const idOrImei = selectedVehicle.imei || selectedVehicle.id;
      const res = await axiosInstance.get(`/api/vehicles/${idOrImei}/messages`, {
        params: {
          page: targetPage,
          limit: customLimit,
          startDate,
          endDate,
          startTime,
          endTime
        }
      });

      if (res.data?.success) {
        setPackets(res.data.data || []);
        const p = res.data.pagination || {};
        setPage(p.page || targetPage);
        setTotalCount(p.total || (res.data.data ? res.data.data.length : 0));
        setTotalPages(p.totalPages || 1);
      } else {
        setPackets([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Error fetching device packets:', err);
      setPackets([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoadingPackets(false);
    }
  }, [selectedVehicle, startDate, endDate, startTime, endTime, limit]);

  // Trigger fetch when vehicle or date/time changes
  useEffect(() => {
    if (selectedVehicle) {
      fetchPackets(1);
    }
  }, [selectedVehicle, startDate, endDate, startTime, endTime, limit, fetchPackets]);

  // Filtered vehicles list for sidebar
  const filteredVehicles = useMemo(() => {
    let list = vehicles;
    if (selectedGroupId !== 'all') {
      list = list.filter(v => {
        const matchGroup = Array.isArray(v.groups) && v.groups.some(g => String(g.id) === String(selectedGroupId));
        const matchId = String(v.group_id) === String(selectedGroupId);
        return matchGroup || matchId;
      });
    }
    if (vehicleSearch.trim()) {
      const q = vehicleSearch.toLowerCase().trim();
      list = list.filter(v =>
        (v.plate && v.plate.toLowerCase().includes(q)) ||
        (v.name && v.name.toLowerCase().includes(q)) ||
        (v.imei && v.imei.toLowerCase().includes(q))
      );
    }
    return list;
  }, [vehicles, selectedGroupId, vehicleSearch]);

  // Active group name for banner
  const activeGroupName = useMemo(() => {
    if (!selectedVehicle) return 'Fleet';
    if (Array.isArray(selectedVehicle.groups) && selectedVehicle.groups.length > 0) {
      return selectedVehicle.groups[0].name || 'Fleet';
    }
    if (selectedVehicle.group_name) return selectedVehicle.group_name;
    const g = groups.find(x => String(x.id) === String(selectedVehicle.group_id));
    return g?.name || 'Fleet';
  }, [selectedVehicle, groups]);

  // Copy raw message
  const handleCopyMessage = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (!packets.length) return;
    const vName = selectedVehicle?.plate || selectedVehicle?.name || 'Device';
    const rows = packets.map(p => ({
      'Server Date & Time': formatLegacyDateTime(p.received_at),
      'Device Time': formatLegacyDateTime(p.device_time),
      'Device Odometer': p.odometer != null ? p.odometer : 0,
      'Device Message': formatDeviceMessage(p),
      'Protocol Status': '-',
      'Packet Type': p.packet_type || (p.parsed ? 'Valid' : 'DATA')
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Device Data');
    XLSX.writeFile(wb, `Device_Data_${vName}_${startDate}.xlsx`);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50 dark:bg-slate-900 font-sans">
      {/* ── LEFT VEHICLE SIDEBAR (Matching legacy fuelProtocol left panel) ── */}
      <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col flex-shrink-0">
        {/* Search input */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800">
          <div className="relative">
            <input
              type="text"
              placeholder="Search vehicle..."
              value={vehicleSearch}
              onChange={(e) => setVehicleSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          </div>

          {/* Group dropdown */}
          <div className="mt-2">
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full px-2 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="all">All Groups ({vehicles.length})</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Vehicles list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
          {loadingFleet ? (
            <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-600" />
              Loading fleet...
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No vehicles found
            </div>
          ) : (
            filteredVehicles.map(v => {
              const isSelected = selectedVehicle && String(selectedVehicle.id) === String(v.id);
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    setSelectedVehicle(v);
                    navigate(`/device-data/${v.id}`, { replace: true });
                  }}
                  className={`w-full text-left px-3.5 py-2.5 text-xs font-medium flex items-center gap-2.5 transition-colors ${
                    isSelected
                      ? 'bg-slate-200/90 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold border-l-4 border-cyan-500'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <Truck className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-cyan-600' : 'text-slate-400'}`} />
                  <div className="truncate flex-1">
                    <div className="truncate">{v.plate || v.name || 'Unnamed'}</div>
                    {v.name && v.plate && v.name !== v.plate && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{v.name}</div>
                    )}
                  </div>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    v.status === 'running' || v.speed > 0
                      ? 'bg-emerald-500'
                      : v.status === 'idle'
                      ? 'bg-amber-400'
                      : 'bg-slate-300 dark:bg-slate-600'
                  }`} />
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-900">
        {/* Top Info Banner (Matching legacy fuelProtocol banner) */}
        <div className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-6 divide-x divide-slate-300 dark:divide-slate-700">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Vehicle Group:</span>
              <span className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                {activeGroupName}
              </span>
            </div>
            <div className="pl-6 flex items-center gap-2">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Vehicle Name:</span>
              <span className="font-bold text-cyan-700 dark:text-cyan-400 uppercase tracking-wide">
                {selectedVehicle?.plate || selectedVehicle?.name || '—'}
              </span>
            </div>
            {selectedVehicle?.imei && (
              <div className="pl-6 flex items-center gap-2 text-slate-500">
                <span>IMEI:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{selectedVehicle.imei}</span>
              </div>
            )}
          </div>

          {/* Export & Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={packets.length === 0}
              className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 flex items-center gap-1.5 text-xs shadow-sm transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Excel
            </button>
            <button
              onClick={() => fetchPackets(page)}
              disabled={loadingPackets}
              className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 shadow-sm transition-all"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingPackets ? 'animate-spin text-cyan-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Date Range & Time Range Toolbar */}
        <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick Presets */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded p-0.5 border border-slate-200 dark:border-slate-700">
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'last24h', label: 'Last 24h' }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => handlePresetSelect(p.id)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                    activePreset === p.id
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block" />

            {/* From Date & Time */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px]">From:</span>
              <TelematicsDatePicker
                value={startDate}
                onChange={(d) => {
                  setStartDate(d);
                  setActivePreset('custom');
                }}
              />
              <TelematicsTimePicker
                value={startTime}
                onChange={(t) => {
                  setStartTime(t);
                  setActivePreset('custom');
                }}
              />
            </div>

            {/* To Date & Time */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px]">To:</span>
              <TelematicsDatePicker
                value={endDate}
                onChange={(d) => {
                  setEndDate(d);
                  setActivePreset('custom');
                }}
              />
              <TelematicsTimePicker
                value={endTime}
                onChange={(t) => {
                  setEndTime(t);
                  setActivePreset('custom');
                }}
              />
            </div>

            {/* Apply Button */}
            <button
              onClick={() => fetchPackets(1)}
              disabled={loadingPackets}
              className="px-3 py-1 rounded bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold hover:brightness-105 active:scale-95 disabled:opacity-40 transition-all shadow-sm"
            >
              Filter
            </button>
          </div>

          {/* Rows per page selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs">Rows:</span>
            <select
              value={limit}
              onChange={(e) => {
                const newLimit = parseInt(e.target.value);
                setLimit(newLimit);
                fetchPackets(1, newLimit);
              }}
              className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
          </div>
        </div>

        {/* ── DATA TABLE (Exact columns matching legacy fuelProtocol) ── */}
        <div className="flex-1 overflow-auto relative">
          {loadingPackets ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-20">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-600 mb-2" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Retrieving device packets...
              </p>
            </div>
          ) : packets.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No device packets recorded for the selected vehicle and date/time range.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700 z-10 shadow-sm">
                <tr>
                  <th className="py-2 px-3 border-r border-slate-200 dark:border-slate-700/80 whitespace-nowrap">
                    Date & Time
                  </th>
                  <th className="py-2 px-3 border-r border-slate-200 dark:border-slate-700/80 whitespace-nowrap">
                    Device Time
                  </th>
                  <th className="py-2 px-3 border-r border-slate-200 dark:border-slate-700/80 whitespace-nowrap">
                    Device Odo
                  </th>
                  <th className="py-2 px-3 border-r border-slate-200 dark:border-slate-700/80">
                    Device Message
                  </th>
                  <th className="py-2 px-3 border-r border-slate-200 dark:border-slate-700/80 text-center whitespace-nowrap">
                    Protocol Status
                  </th>
                  <th className="py-2 px-3 text-center whitespace-nowrap">
                    Packet Type
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-[11.5px]">
                {packets.map((pkt, idx) => {
                  const rawMsg = formatDeviceMessage(pkt);
                  return (
                    <tr
                      key={pkt.id || idx}
                      className="hover:bg-cyan-50/40 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-1.5 px-3 whitespace-nowrap text-slate-700 dark:text-slate-300 font-sans">
                        {formatLegacyDateTime(pkt.received_at)}
                      </td>
                      <td className="py-1.5 px-3 whitespace-nowrap text-slate-700 dark:text-slate-300 font-sans">
                        {formatLegacyDateTime(pkt.device_time)}
                      </td>
                      <td className="py-1.5 px-3 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                        {pkt.odometer != null ? pkt.odometer : 0}
                      </td>
                      <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300 font-mono text-[11px] break-all max-w-xl group">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{rawMsg}</span>
                          <button
                            onClick={() => handleCopyMessage(pkt.id || idx, rawMsg)}
                            title="Copy raw packet"
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 transition-all flex-shrink-0"
                          >
                            {copiedId === (pkt.id || idx) ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-1.5 px-3 text-center whitespace-nowrap text-slate-400">
                        -
                      </td>
                      <td className="py-1.5 px-3 text-center whitespace-nowrap font-sans font-medium text-slate-700 dark:text-slate-300">
                        {pkt.packet_type || (pkt.parsed ? 'Valid' : 'DATA')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── PAGINATION TOOLBAR ── */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <span className="font-bold text-slate-700 dark:text-slate-200">
              {totalCount === 0 ? 0 : (page - 1) * limit + 1}
            </span> to <span className="font-bold text-slate-700 dark:text-slate-200">
              {Math.min(page * limit, totalCount)}
            </span> of <span className="font-bold text-slate-700 dark:text-slate-200">
              {totalCount.toLocaleString()}
            </span> packets
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => fetchPackets(page - 1)}
              disabled={page <= 1 || loadingPackets}
              className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-semibold text-slate-600 dark:text-slate-300">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => fetchPackets(page + 1)}
              disabled={page >= totalPages || loadingPackets}
              className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-100 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

