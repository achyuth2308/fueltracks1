import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cpu,
  Fuel,
  Gauge,
  BatteryCharging,
  Clock,
  ShieldAlert,
  Navigation,
  Eye,
  Copy,
  Check,
  Pause,
  Play,
  Trash2,
  RefreshCw,
  Search,
  ChevronDown,
  X,
  Radio,
  Calendar,
  Layers,
  History,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import axiosInstance from '../../api/axios';
import { useSocket } from '../../hooks/useSocket';
import { parseObdPacket } from '../../utils/obdPacketParser';
import { copyToClipboard } from '../../utils/clipboard';

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatIST(dateObj) {
  if (!dateObj) return '—';
  try {
    const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch (e) {
    return '—';
  }
}

function formatTimeIST(dateObj) {
  if (!dateObj) return '—';
  try {
    const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch (e) {
    return '—';
  }
}

export default function ObdTerminalPage() {
  const navigate = useNavigate();
  const { socket, joinVehicleRoom, leaveVehicleRoom } = useSocket();

  // Mode: 'LIVE' or 'HISTORY'
  const [terminalMode, setTerminalMode] = useState('LIVE');

  // Vehicles list & selection
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Live Stream State
  const [isPaused, setIsPaused] = useState(false);
  const [livePackets, setLivePackets] = useState([]); // Ring buffer max 50
  const [livePacketCount, setLivePacketCount] = useState(0);
  const [autoFollowLatest, setAutoFollowLatest] = useState(true);

  // History State
  const [historyDate, setHistoryDate] = useState(getTodayString());
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');
  const [historyLimit, setHistoryLimit] = useState(50);
  const [historyPackets, setHistoryPackets] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  // Selected packet for the 6 Category Cards (Active diagnostic state)
  const [activePacket, setActivePacket] = useState(null);

  // Modal Inspector State
  const [inspectPacket, setInspectPacket] = useState(null);
  const [isHexModalOpen, setIsHexModalOpen] = useState(false);
  const [copiedHex, setCopiedHex] = useState(false);

  const dropdownRef = useRef(null);

  // Fetch Vehicles on Mount
  useEffect(() => {
    axiosInstance.get('/api/vehicles?limit=500')
      .then(res => {
        const list = res.data?.data || (Array.isArray(res.data) ? res.data : []);
        setVehicles(list);
        const defaultObd = list.find(v => 
          (v.device_model && v.device_model.toUpperCase().includes('B20')) ||
          (v.plate && v.plate.toUpperCase().includes('OBD')) ||
          (v.model && v.model.toUpperCase().includes('B20'))
        ) || list[0];

        if (defaultObd) {
          setSelectedVehicle(defaultObd);
        }
      })
      .catch(err => console.error('Failed to load vehicles:', err));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeImei = selectedVehicle?.imei;

  // Join the selected vehicle's Socket.io room for live streaming
  useEffect(() => {
    if (!selectedVehicle?.id || !joinVehicleRoom) return;
    joinVehicleRoom(selectedVehicle.id);
    return () => {
      if (leaveVehicleRoom) leaveVehicleRoom(selectedVehicle.id);
    };
  }, [selectedVehicle?.id, joinVehicleRoom, leaveVehicleRoom]);

  // Listen to live WebSocket `raw:update`
  useEffect(() => {
    if (!socket || !selectedVehicle || terminalMode !== 'LIVE') return;

    const handleRaw = (data) => {
      if (isPaused) return;

      const incomingImei = String(data?.imei || '');
      const incomingVehId = data?.vehicleId ? String(data.vehicleId) : '';
      const cleanActive = String(activeImei || '');
      const cleanActiveId = String(selectedVehicle.id || '');

      const isMatch = (cleanActive && incomingImei === cleanActive) ||
                      (cleanActiveId && incomingVehId === cleanActiveId) ||
                      (data?.terminalId && cleanActive.includes(data.terminalId));

      if (isMatch) {
        const rawHex = data.raw_hex || data.rawHex || data.rawPacket || data.rawString || data.raw || '';
        let parsed = null;
        if (rawHex) {
          parsed = parseObdPacket(rawHex);
        }

        const packetObj = {
          id: data.id || `${Date.now()}_${Math.random()}`,
          time: data.device_time ? new Date(data.device_time) : (data.received_at ? new Date(data.received_at) : new Date()),
          rawHex: rawHex,
          data: parsed || data.parsed_data || data,
          source: 'LIVE'
        };

        setLivePackets(prev => {
          const next = [packetObj, ...prev];
          return next.slice(0, 50); // Ring buffer max 50 in memory (zero RAM spike)
        });

        // Only auto-update cards if user hasn't explicitly clicked a past row to inspect
        if (autoFollowLatest) {
          setActivePacket(packetObj);
        }
        setLivePacketCount(c => c + 1);
      }
    };

    socket.on('raw:update', handleRaw);
    return () => socket.off('raw:update', handleRaw);
  }, [socket, selectedVehicle, activeImei, isPaused, terminalMode, autoFollowLatest]);

  // Fetch Historical Packets from API
  const fetchHistoricalPackets = async () => {
    if (!selectedVehicle) {
      setHistoryError('Please select a vehicle first.');
      return;
    }
    setLoadingHistory(true);
    setHistoryError(null);

    const vehicleIdentifier = selectedVehicle.id || selectedVehicle.imei;

    try {
      const res = await axiosInstance.get(`/api/vehicles/${vehicleIdentifier}/messages`, {
        params: {
          limit: historyLimit,
          date: historyDate || null,
          startDate: historyDate || null,
          endDate: historyDate || null,
          startTime: startTime ? `${startTime}:00` : null,
          endTime: endTime ? `${endTime}:59` : null
        }
      });

      if (res.data?.success) {
        const rawList = res.data.data || [];
        const mapped = rawList.map(item => {
          const rawHex = item.raw_hex || item.raw || item.raw_packet || '';
          let parsed = null;
          if (rawHex) {
            parsed = parseObdPacket(rawHex);
          }
          const packetTime = item.device_time ? new Date(item.device_time) : (item.received_at ? new Date(item.received_at) : new Date());
          return {
            id: item.id || `${packetTime.getTime()}_${Math.random()}`,
            time: packetTime,
            rawHex: rawHex,
            data: parsed || item.parsed_data || item,
            source: 'HISTORY'
          };
        });

        setHistoryPackets(mapped);
        if (mapped.length > 0) {
          setActivePacket(mapped[0]); // Select first packet to populate cards
        } else {
          setHistoryError(`No packets recorded for ${historyDate} between ${startTime} and ${endTime}.`);
        }
      } else {
        setHistoryError(res.data?.error || 'Failed to load historical packets.');
      }
    } catch (err) {
      console.error('History fetch error:', err);
      setHistoryError(err.response?.data?.error || 'Error connecting to database.');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Copy raw hex
  const handleCopy = async (hex) => {
    if (!hex) return;
    const ok = await copyToClipboard(hex);
    if (ok) {
      setCopiedHex(true);
      setTimeout(() => setCopiedHex(false), 2000);
    }
  };

  // Open Raw Hex Inspector
  const openInspector = (pkt) => {
    if (!pkt) return;
    setInspectPacket(pkt);
    setIsHexModalOpen(true);
  };

  const filteredVehicles = useMemo(() => {
    if (!searchQuery) return vehicles;
    const q = searchQuery.toLowerCase();
    return vehicles.filter(v => 
      (v.plate || '').toLowerCase().includes(q) ||
      (v.name || '').toLowerCase().includes(q) ||
      (v.imei || '').toLowerCase().includes(q) ||
      (v.model || '').toLowerCase().includes(q)
    );
  }, [vehicles, searchQuery]);

  // Which packet list is active: LIVE or HISTORY
  const displayedPackets = terminalMode === 'LIVE' ? livePackets : historyPackets;
  const currentTelemetry = activePacket?.data || null;

  // Fuel & Engine State Analysis
  const vehicleTankCapacity = Number(selectedVehicle?.tank_capacity || selectedVehicle?.tank_size || 0);
  const rawRemainingL = currentTelemetry?.fuelRemainingL;
  const isIgnitionOn = currentTelemetry?.ignition === true;
  const isEcuSleeping = !isIgnitionOn && (currentTelemetry?.engineRpm === 0 || currentTelemetry?.engineRpm == null);

  let effectivePct = null;
  if (currentTelemetry?.fuelLevelPct !== null && currentTelemetry?.fuelLevelPct !== undefined && currentTelemetry.fuelLevelPct > 0) {
    effectivePct = currentTelemetry.fuelLevelPct;
  } else if (rawRemainingL > 0 && vehicleTankCapacity > 0) {
    effectivePct = Math.min(100, Math.round((rawRemainingL / vehicleTankCapacity) * 100));
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 pb-24">
      
      {/* ── TOP HEADER & VEHICLE / MODE CONTROLS ─────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 md:p-5 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left: Title & Vehicle Selector */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-100">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-slate-900 tracking-tight">OBD Live Diagnostic Terminal</h1>
                  <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    B20 Protocol
                  </span>
                </div>
                <p className="text-xs text-slate-500">CAN-Bus ECU live parameters & historical playback (JT808 / GB/T 19056)</p>
              </div>
            </div>

            {/* Vehicle Selector Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-3 px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 rounded-xl text-sm font-medium border border-slate-300/80 transition-all shadow-sm"
              >
                <span className="text-slate-500 text-xs font-normal">Vehicle:</span>
                <span className="font-semibold text-slate-900">
                  {selectedVehicle ? (selectedVehicle.plate || selectedVehicle.name || selectedVehicle.imei) : 'Select OBD Vehicle'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </button>

              {isDropdownOpen && (
                <div className="absolute left-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2 max-h-96 overflow-y-auto">
                  <div className="relative mb-2">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search plate or IMEI..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    {filteredVehicles.map(v => (
                      <button
                        key={v.id || v.imei}
                        type="button"
                        onClick={() => {
                          setSelectedVehicle(v);
                          setLivePackets([]);
                          setHistoryPackets([]);
                          setActivePacket(null);
                          setLivePacketCount(0);
                          setIsDropdownOpen(false);
                          if (terminalMode === 'HISTORY') {
                            setTimeout(() => fetchHistoricalPackets(), 50);
                          }
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          selectedVehicle?.imei === v.imei ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div>
                          <div className="font-medium text-slate-900">{v.plate || v.name || 'Unnamed'}</div>
                          <div className="text-[11px] text-slate-500 font-mono">IMEI: {v.imei}</div>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium uppercase">
                          {v.device_model || v.model || 'OBD'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Mode Toggle (LIVE vs HISTORY) */}
          <div className="flex items-center gap-2 bg-slate-100/90 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => {
                setTerminalMode('LIVE');
                setAutoFollowLatest(true);
                if (livePackets.length > 0) setActivePacket(livePackets[0]);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                terminalMode === 'LIVE'
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Live Feed
            </button>

            <button
              onClick={() => {
                setTerminalMode('HISTORY');
                if (historyPackets.length > 0) {
                  setActivePacket(historyPackets[0]);
                } else {
                  fetchHistoricalPackets();
                }
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                terminalMode === 'HISTORY'
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              Historical Range
            </button>
          </div>

        </div>

        {/* ── CONTROLS TOOLBAR: LIVE CONTROLS vs HISTORICAL DATE FILTER ── */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          
          {terminalMode === 'LIVE' ? (
            /* Live Stream Controls */
            <div className="flex items-center gap-3 flex-wrap w-full justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Active Live Feed:</span>
                  <span className="font-semibold text-slate-900 font-mono">{livePacketCount} packets received</span>
                </div>
                {isPaused && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    STREAM FROZEN
                  </span>
                )}
                {!autoFollowLatest && (
                  <button
                    onClick={() => {
                      setAutoFollowLatest(true);
                      if (livePackets.length > 0) setActivePacket(livePackets[0]);
                    }}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-600" />
                    Resume Auto-Follow Latest
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shadow-sm ${
                    isPaused 
                      ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600' 
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                  }`}
                >
                  {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  {isPaused ? 'Resume Stream' : 'Pause Stream'}
                </button>

                <button
                  onClick={() => {
                    setLivePackets([]);
                    setLivePacketCount(0);
                    setActivePacket(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition-all shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                  Clear
                </button>

                <button
                  onClick={() => openInspector(activePacket || livePackets[0] || null)}
                  disabled={!activePacket && livePackets.length === 0}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all disabled:opacity-50"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Inspect Raw Hex
                </button>
              </div>
            </div>
          ) : (
            /* Historical Date/Time Range Controls */
            <div className="flex items-center gap-3 flex-wrap w-full justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Date Picker + Presets */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">Date:</span>
                  <input
                    type="date"
                    value={historyDate}
                    onChange={e => setHistoryDate(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setHistoryDate(getTodayString())}
                      className={`px-2 py-1 text-[11px] rounded font-semibold border ${
                        historyDate === getTodayString() ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryDate(getYesterdayString())}
                      className={`px-2 py-1 text-[11px] rounded font-semibold border ${
                        historyDate === getYesterdayString() ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      Yesterday
                    </button>
                  </div>
                </div>

                {/* Time Range */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">Time:</span>
                  <input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
                  />
                </div>

                {/* Record Limit */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">Limit:</span>
                  <select
                    value={historyLimit}
                    onChange={e => setHistoryLimit(Number(e.target.value))}
                    className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none shadow-sm"
                  >
                    <option value={25}>25 packets</option>
                    <option value={50}>50 packets</option>
                    <option value={100}>100 packets</option>
                    <option value={200}>200 packets</option>
                    <option value={500}>500 packets</option>
                  </select>
                </div>

                {/* Load Button */}
                <button
                  onClick={fetchHistoricalPackets}
                  disabled={loadingHistory}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                  {loadingHistory ? 'Loading...' : 'Load Historical Packets'}
                </button>
              </div>

              {/* Inspect Button in History Mode */}
              <button
                onClick={() => openInspector(activePacket || historyPackets[0] || null)}
                disabled={!activePacket && historyPackets.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white shadow-sm transition-all disabled:opacity-50"
              >
                <Eye className="w-3.5 h-3.5" />
                Inspect Selected Hex
              </button>
            </div>
          )}

        </div>

      </div>

      {/* ── ACTIVE INSPECTION STATUS BANNER ───────────────────────────── */}
      {activePacket && (
        <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl px-4 py-2.5 mb-6 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-indigo-900 font-medium">
            <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-bold text-[10px] uppercase">
              {activePacket.source === 'LIVE' ? 'Live Telemetry' : 'Historical Packet'}
            </span>
            <span>Displaying decoded data from:</span>
            <span className="font-mono font-bold text-indigo-950">
              {formatIST(activePacket.time)}
            </span>
            {activePacket.data?.seqNum && (
              <span className="text-indigo-600 font-mono">(Seq #{activePacket.data.seqNum})</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-indigo-700 font-medium hidden sm:inline">
              💡 Click any row in the packets table below to inspect its exact telemetry
            </span>
            <button
              onClick={() => openInspector(activePacket)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 text-[11px] font-semibold transition-colors"
            >
              <Eye className="w-3 h-3" />
              View Hex
            </button>
          </div>
        </div>
      )}

      {/* ── 6 CATEGORY DIAGNOSTIC CARDS (2-COLUMN STRUCTURE) ──────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        
        {/* CARD 1: ⛽ FUEL INTELLIGENCE */}
        <DiagnosticCard
          title="Fuel Intelligence"
          icon={<Fuel className="w-5 h-5 text-emerald-600" />}
          accentColor="emerald"
          badge={
            isEcuSleeping && (!rawRemainingL || rawRemainingL === 0)
              ? 'ECU Standby'
              : (rawRemainingL !== undefined && rawRemainingL !== null ? `${rawRemainingL} L in Tank` : 'Live ECU')
          }
        >
          {/* Section A: Tank Volume & Gauge */}
          <div className="pb-2.5 mb-2.5 border-b border-slate-100">
            <div className="flex items-center justify-between text-[10px] font-bold tracking-wider uppercase text-emerald-700 mb-1.5">
              <span>⛽ Fuel Tank Level (Current Volume)</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                isEcuSleeping 
                  ? 'bg-slate-100 text-slate-600 border-slate-200' 
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {isEcuSleeping ? 'ECU In Sleep Mode' : 'Inside Tank'}
              </span>
            </div>
            
            {isEcuSleeping && (!rawRemainingL || rawRemainingL === 0) ? (
              <div className="py-2.5 px-3 bg-slate-50/80 rounded-xl border border-slate-200/60 my-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Tank Fuel Reading:</span>
                  <span className="font-mono text-slate-500">ECU Standby (Ignition OFF)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Vehicle ignition is turned OFF. The car's CAN-bus fuel float sensor goes into low-power sleep mode while parked.
                </p>
              </div>
            ) : (
              <>
                <DataRow 
                  label="Current Fuel in Tank (Remaining)" 
                  value={formatNum(rawRemainingL, 'Litres')} 
                  highlight 
                />

                {/* Visual Fuel Gauge Bar (Only shown if effective percentage is known) */}
                {effectivePct !== null ? (
                  <div className="py-1.5 px-0.5">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500 font-medium text-[11px]">Fuel Gauge Level</span>
                      <span className={`font-mono font-bold text-[11px] ${
                        effectivePct <= 15 ? 'text-rose-600' : 'text-emerald-600'
                      }`}>
                        {effectivePct}% {effectivePct <= 15 ? '⚠️ Low Reserve' : '✓ Normal'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                      <div 
                        className={`h-full transition-all duration-500 rounded-full ${
                          effectivePct <= 15 
                            ? 'bg-gradient-to-r from-rose-500 to-amber-500' 
                            : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(3, effectivePct))}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <DataRow 
                    label="ECU Diagnostic Reading" 
                    value={rawRemainingL ? `${rawRemainingL} L (PID 0x000D)` : '—'} 
                    badge="bg-emerald-50 text-emerald-700 font-mono text-[10px]"
                  />
                )}
                
                <DataRow 
                  label="Tank Level Percentage" 
                  value={
                    effectivePct !== null 
                      ? `${effectivePct} %` 
                      : (rawRemainingL ? 'Liters Direct (CAN)' : '—')
                  } 
                  badge={
                    effectivePct !== null
                      ? (effectivePct <= 15 ? 'bg-rose-100 text-rose-800 font-bold' : 'bg-emerald-50 text-emerald-700')
                      : 'bg-slate-100 text-slate-600'
                  }
                />
              </>
            )}
          </div>

          {/* Section B: Engine Consumption (Cumulative Burned) */}
          <div className="pb-2 mb-2 border-b border-slate-100">
            <div className="flex items-center justify-between text-[10px] font-bold tracking-wider uppercase text-amber-700 mb-1">
              <span>🔥 Engine Consumption (Burned Fuel)</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                Odometer
              </span>
            </div>

            <DataRow 
              label="Trip Fuel Burned (Current Trip)" 
              value={formatNum(currentTelemetry?.tripFuelL, 'Litres')} 
            />
            <DataRow 
              label="Lifetime Fuel Burned (Engine Total)" 
              value={formatNum(currentTelemetry?.totalFuelL, 'Litres')} 
              highlight 
              badge="bg-amber-50 text-amber-800 font-semibold"
            />
          </div>

          {/* Section C: Economy & Pressures */}
          <div>
            <DataRow label="Instant Fuel Burn" value={formatNum(currentTelemetry?.instantFuelL100km, 'L/100km')} />
            <DataRow label="Average Fuel Economy" value={formatNum(currentTelemetry?.avgFuelL100km, 'L/100km')} />
            <DataRow label="Auxiliary Tank (Tag 02)" value={formatNum(currentTelemetry?.auxFuelL, 'Litres')} />
            <DataRow label="Fuel Rail Pressure" value={formatNum(currentTelemetry?.fuelRailPressureKpa, 'kPa')} />
          </div>
        </DiagnosticCard>

        {/* CARD 2: ⚙️ ENGINE & ECU DIAGNOSTICS */}
        <DiagnosticCard
          title="Engine & ECU Diagnostics"
          icon={<Gauge className="w-5 h-5 text-indigo-600" />}
          accentColor="indigo"
          badge={currentTelemetry?.engineRpm !== undefined && currentTelemetry?.engineRpm !== null ? `${currentTelemetry.engineRpm} RPM` : 'Live CAN'}
        >
          <DataRow label="Engine RPM" value={formatNum(currentTelemetry?.engineRpm, 'RPM')} highlight />
          <DataRow label="ECU Wheel Speed" value={formatNum(currentTelemetry?.ecuWheelSpeedKmh, 'km/h')} />
          <DataRow label="Throttle / Pedal Position" value={formatNum(currentTelemetry?.throttlePct, '%')} />
          <DataRow label="Calculated Engine Load" value={formatNum(currentTelemetry?.engineLoadPct, '%')} />
          <DataRow label="Coolant Temperature" value={formatNum(currentTelemetry?.coolantTempC, '°C')} highlight />
          <DataRow label="Intake Air Temperature" value={formatNum(currentTelemetry?.intakeAirTempC, '°C')} />
          <DataRow label="Manifold Pressure (MAP)" value={formatNum(currentTelemetry?.manifoldPressureKpa, 'kPa')} />
          <DataRow label="Mass Air Flow (MAF)" value={formatNum(currentTelemetry?.mafGps, 'g/s')} />
        </DiagnosticCard>

        {/* CARD 3: 🔋 BATTERY & ELECTRICAL SYSTEMS */}
        <DiagnosticCard
          title="Battery & Electrical"
          icon={<BatteryCharging className="w-5 h-5 text-amber-600" />}
          accentColor="amber"
          badge={currentTelemetry?.batteryVoltageV !== undefined && currentTelemetry?.batteryVoltageV !== null ? `${currentTelemetry.batteryVoltageV} V` : 'Power'}
        >
          <DataRow label="Alternator / Battery Voltage" value={formatNum(currentTelemetry?.batteryVoltageV, 'V')} highlight />
          <DataRow label="OBD Port Voltage" value={formatNum(currentTelemetry?.obdVoltageV, 'V')} />
          <DataRow label="Backup Battery Health" value={formatNum(currentTelemetry?.backupBatteryPct, '%')} />
          <DataRow label="Charging State" value={currentTelemetry?.chargingState || 'Normal'} badge={currentTelemetry?.batteryVoltageV > 13.0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'} />
          <DataRow label="Power Cut Alert" value="Normal (Connected)" />
          <DataRow label="Ignition ACC State" value={currentTelemetry?.ignition ? 'IGNITION ON' : 'IGNITION OFF'} badge={currentTelemetry?.ignition ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-slate-100 text-slate-700'} />
        </DiagnosticCard>

        {/* CARD 4: ⏱️ MILEAGE, RUN TIME & TIMERS */}
        <DiagnosticCard
          title="Mileage & Run Time"
          icon={<Clock className="w-5 h-5 text-cyan-600" />}
          accentColor="cyan"
          badge={currentTelemetry?.clusterOdometerKm !== undefined && currentTelemetry?.clusterOdometerKm !== null ? `${currentTelemetry.clusterOdometerKm} km` : 'Odometers'}
        >
          <DataRow label="Cluster Total Odometer" value={formatNum(currentTelemetry?.clusterOdometerKm, 'km')} highlight />
          <DataRow label="GPS Total Odometer" value={formatNum(currentTelemetry?.gpsOdometerKm, 'km')} />
          <DataRow label="Current Trip Distance" value={formatNum(currentTelemetry?.tripDistanceKm, 'km')} />
          <DataRow label="Total Engine Run Time" value={formatSeconds(currentTelemetry?.totalEngineRunTimeSec)} />
          <DataRow label="Engine Idling Duration" value={formatSeconds(currentTelemetry?.engineIdleTimeSec)} />
          <DataRow label="Continuous Driving Duration" value={formatSeconds(currentTelemetry?.continuousDriveTimeSec)} />
        </DiagnosticCard>

        {/* CARD 5: ⚠️ DRIVER BEHAVIOR & ECU HEALTH */}
        <DiagnosticCard
          title="Driver Behavior & DTC"
          icon={<ShieldAlert className="w-5 h-5 text-rose-600" />}
          accentColor="rose"
          badge={currentTelemetry?.dtcCount === 0 ? '0 DTC Codes' : `${currentTelemetry?.dtcCount || 0} DTC`}
        >
          <DataRow label="Check Engine (DTC Faults)" value={currentTelemetry?.dtcCount !== undefined && currentTelemetry?.dtcCount !== null ? `${currentTelemetry.dtcCount} Active Codes` : '0 Active Codes'} badge={currentTelemetry?.dtcCount > 0 ? 'bg-rose-100 text-rose-800 font-bold' : 'bg-emerald-50 text-emerald-700 font-semibold'} />
          <DataRow label="Rapid Acceleration Events" value={formatNum(currentTelemetry?.rapidAccelCount, 'events')} />
          <DataRow label="Harsh Braking Events" value={formatNum(currentTelemetry?.rapidDecelCount, 'events')} />
          <DataRow label="Harsh Cornering Events" value={formatNum(currentTelemetry?.harshCornerCount, 'events')} />
          <DataRow label="Chassis VIN Code" value={currentTelemetry?.vin || 'Auto-Read from ECU'} />
          <DataRow label="CAN Protocol Standard" value="ISO 15765-4 (CAN 11-bit)" />
        </DiagnosticCard>

        {/* CARD 6: 🛰️ GPS & TELEMETRY */}
        <DiagnosticCard
          title="GPS & Telematics"
          icon={<Navigation className="w-5 h-5 text-sky-600" />}
          accentColor="sky"
          badge={currentTelemetry?.satellites !== undefined && currentTelemetry?.satellites !== null ? `${currentTelemetry.satellites} Sats` : 'Fix Status'}
        >
          <DataRow label="GPS Fix Status" value={currentTelemetry?.gpsValid ? '3D Valid Fix' : 'No Fix'} badge={currentTelemetry?.gpsValid ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-amber-100 text-amber-800'} />
          <DataRow label="GPS Ground Speed" value={formatNum(currentTelemetry?.gpsSpeedKmh, 'km/h')} highlight />
          <DataRow label="GNSS Satellites Tracked" value={formatNum(currentTelemetry?.satellites, 'Satellites')} />
          <DataRow label="Cellular Signal (RSSI)" value={currentTelemetry?.gsmSignal !== null && currentTelemetry?.gsmSignal !== undefined ? `${currentTelemetry.gsmSignal} / 31` : '—'} />
          <DataRow label="Coordinates (Lat, Lng)" value={currentTelemetry?.lat && currentTelemetry?.lng ? `${Number(currentTelemetry.lat).toFixed(6)}, ${Number(currentTelemetry.lng).toFixed(6)}` : '—'} />
          <DataRow label="Heading & Altitude" value={currentTelemetry?.headingDeg !== null && currentTelemetry?.headingDeg !== undefined ? `${currentTelemetry.headingDeg}° (${currentTelemetry.altitudeM || 0}m)` : '—'} />
          <DataRow label="Device UTC Timestamp" value={currentTelemetry?.deviceTimeStr || '—'} />
        </DiagnosticCard>

      </div>

      {/* ── PACKETS STREAM & HISTORY TABLE ───────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              {terminalMode === 'LIVE' ? 'Live Incoming Packets Buffer' : `Historical Packets: ${historyDate}`}
            </h2>
            <p className="text-xs text-slate-500">
              {terminalMode === 'LIVE' 
                ? 'Ring buffer keeping latest 50 live packets for maximum performance' 
                : 'Click any row to inspect its full diagnostic breakdown in the cards above'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {displayedPackets.length} Packets
            </span>
          </div>
        </div>

        {displayedPackets.length === 0 ? (
          <div className="py-14 text-center">
            {terminalMode === 'LIVE' ? (
              <>
                <Radio className="w-10 h-10 text-slate-300 mx-auto mb-3 animate-pulse" />
                <p className="text-sm font-semibold text-slate-700">Waiting for live packets from {selectedVehicle?.plate || selectedVehicle?.imei || 'device'}...</p>
                <p className="text-xs text-slate-400 mt-1">Packets will stream in automatically as the OBD tracker communicates.</p>
              </>
            ) : (
              <>
                <History className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700">{historyError || 'No historical packets loaded yet.'}</p>
                <p className="text-xs text-slate-400 mt-1">Select a date and click "Load Historical Packets" to inspect past driving logs.</p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200 font-bold">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Time (IST)</th>
                  <th className="py-3 px-4">Packet Type</th>
                  <th className="py-3 px-4">RPM</th>
                  <th className="py-3 px-4">GPS Speed</th>
                  <th className="py-3 px-4">Voltage</th>
                  <th className="py-3 px-4">In Tank (L)</th>
                  <th className="py-3 px-4">Lifetime Burned (L)</th>
                  <th className="py-3 px-4">Coolant</th>
                  <th className="py-3 px-4">Satellites</th>
                  <th className="py-3 px-4 text-right">Inspect Hex</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedPackets.map((pkt, idx) => {
                  const d = pkt.data || {};
                  const isSelected = activePacket?.id === pkt.id;
                  return (
                    <tr 
                      key={pkt.id || idx} 
                      onClick={() => {
                        setActivePacket(pkt);
                        setAutoFollowLatest(false);
                      }}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-50/90 font-medium border-l-4 border-l-indigo-600' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-2.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                        {formatTimeIST(pkt.time)}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          d.packetType === 'LOCATION_OBD' || d.packetType === 'LOCATION_OBD_TELEMETRY'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {d.packetType || 'TELEMETRY'}
                        </span>
                        {isSelected && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-600 text-white">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-900">
                        {d.engineRpm !== undefined && d.engineRpm !== null ? `${d.engineRpm} RPM` : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-900">
                        {d.gpsSpeedKmh !== null && d.gpsSpeedKmh !== undefined ? `${d.gpsSpeedKmh} km/h` : (d.speed !== undefined ? `${d.speed} km/h` : '—')}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-700">
                        {d.batteryVoltageV ? `${d.batteryVoltageV} V` : (d.voltage ? `${d.voltage} V` : '—')}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-emerald-700">
                        {d.fuelRemainingL !== undefined && d.fuelRemainingL !== null ? `${d.fuelRemainingL} L` : (d.fuel ? `${d.fuel} L` : '—')}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-indigo-700">
                        {d.totalFuelL !== undefined && d.totalFuelL !== null ? `${d.totalFuelL} L` : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-700">
                        {d.coolantTempC !== null && d.coolantTempC !== undefined ? `${d.coolantTempC} °C` : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">
                        {d.satellites || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openInspector(pkt);
                          }}
                          className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                          title="View Raw Hex Packet"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── SLIDE-OVER RAW HEX PACKET INSPECTOR MODAL ────────────────── */}
      {isHexModalOpen && inspectPacket && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 relative">
            <button
              onClick={() => setIsHexModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Raw Hexadecimal Packet Inspector</h3>
                <p className="text-xs text-slate-500">
                  Length: {(inspectPacket.rawHex?.length / 2) || 0} Bytes | Captured at {formatIST(inspectPacket.time)}
                </p>
              </div>
            </div>

            {/* Raw Hex Display Box */}
            <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-emerald-400 break-all leading-relaxed select-all mb-4 max-h-60 overflow-y-auto border border-slate-800">
              {inspectPacket.rawHex || 'No raw hex available'}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-500 font-mono">Framing: 0x7E ... 0x7E</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(inspectPacket.rawHex)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  {copiedHex ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedHex ? 'Copied to Clipboard!' : 'Copy Hex'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsHexModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ── SUBCOMPONENTS ────────────────────────────────────────────────────────

function DiagnosticCard({ title, icon, accentColor, badge, children }) {
  const accentBorders = {
    emerald: 'border-t-emerald-500',
    indigo: 'border-t-indigo-500',
    amber: 'border-t-amber-500',
    cyan: 'border-t-cyan-500',
    rose: 'border-t-rose-500',
    sky: 'border-t-sky-500',
  };

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200/80 border-t-4 ${accentBorders[accentColor] || 'border-t-slate-400'} p-4 flex flex-col justify-between hover:shadow-md transition-shadow`}>
      <div>
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
          </div>
          {badge && (
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              {badge}
            </span>
          )}
        </div>
        <div className="divide-y divide-slate-100">
          {children}
        </div>
      </div>
    </div>
  );
}

function DataRow({ label, value, highlight = false, badge = null }) {
  return (
    <div className="py-2 flex items-center justify-between text-xs gap-3">
      <span className="text-slate-600 font-medium">{label}</span>
      <div className="text-right">
        {badge ? (
          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${badge}`}>
            {value}
          </span>
        ) : (
          <span className={`font-mono tabular-nums ${highlight ? 'font-bold text-slate-900 text-[13px]' : 'text-slate-700 font-medium'}`}>
            {value}
          </span>
        )}
      </div>
    </div>
  );
}

function formatNum(val, unit) {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return `${val} ${unit}`;
}

function formatSeconds(sec) {
  if (sec === null || sec === undefined || isNaN(sec)) return '—';
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${s}s`;
  if (mins > 0) return `${mins}m ${s}s`;
  return `${s}s`;
}
