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
  ExternalLink,
  ChevronDown,
  X,
  Radio,
  Activity,
  AlertTriangle,
  Zap,
  ArrowRight
} from 'lucide-react';
import axiosInstance from '../../api/axios';
import { useSocket } from '../../hooks/useSocket';
import { parseObdPacket } from '../../utils/obdPacketParser';
import { copyToClipboard } from '../../utils/clipboard';

export default function ObdTerminalPage() {
  const navigate = useNavigate();
  const { socket } = useSocket();

  // Vehicles list
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Streaming State
  const [isPaused, setIsPaused] = useState(false);
  const [packets, setPackets] = useState([]); // Ring buffer max 50
  const [latestData, setLatestData] = useState(null);
  const [selectedPacket, setSelectedPacket] = useState(null);
  const [isHexModalOpen, setIsHexModalOpen] = useState(false);
  const [copiedHex, setCopiedHex] = useState(false);
  const [packetCount, setPacketCount] = useState(0);

  const dropdownRef = useRef(null);

  // Fetch OBD Vehicles on Mount
  useEffect(() => {
    axiosInstance.get('/api/vehicles?limit=500')
      .then(res => {
        const list = res.data?.data || (Array.isArray(res.data) ? res.data : []);
        setVehicles(list);
        // Default to first B20 or OBD vehicle if available
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

  // Target IMEI for filtering incoming packets
  const activeImei = selectedVehicle?.imei;

  // Listen to live WebSocket `raw:update`
  useEffect(() => {
    if (!socket || !activeImei) return;

    const handleRaw = (data) => {
      if (isPaused) return;

      // Match IMEI or Terminal ID
      const incomingImei = String(data?.imei || '');
      const cleanActive = String(activeImei);

      if (incomingImei === cleanActive || (data?.terminalId && cleanActive.includes(data.terminalId))) {
        const rawHex = data.rawHex || data.rawPacket || data.rawString;
        let parsed = null;
        if (rawHex) {
          parsed = parseObdPacket(rawHex);
        }

        // If rawHex wasn't present or parser returned null, merge socket data
        const packetObj = {
          id: data.id || `${Date.now()}_${Math.random()}`,
          time: new Date(),
          rawHex: rawHex || '',
          data: parsed || data
        };

        setPackets(prev => {
          const next = [packetObj, ...prev];
          return next.slice(0, 50); // Keep max 50 in memory (zero RAM spike)
        });

        if (parsed) {
          setLatestData(parsed);
        }
        setPacketCount(c => c + 1);
      }
    };

    socket.on('raw:update', handleRaw);
    return () => socket.off('raw:update', handleRaw);
  }, [socket, activeImei, isPaused]);

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
    setSelectedPacket(pkt);
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 pb-20">
      {/* ── TOP NAV & CONTROLS ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left: Title & Vehicle Selector */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-slate-900 tracking-tight">OBD Live Diagnostic Terminal</h1>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    B20 Protocol
                  </span>
                </div>
                <p className="text-xs text-slate-500">Live CAN-Bus telemetry decoded stream (JT808 / GB/T 19056)</p>
              </div>
            </div>

            {/* Vehicle Selector Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-3 px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 rounded-lg text-sm font-medium border border-slate-300 transition-colors"
              >
                <span className="text-slate-500 text-xs">Vehicle:</span>
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
                          setPackets([]);
                          setLatestData(null);
                          setPacketCount(0);
                          setIsDropdownOpen(false);
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

          {/* Right: Stream Status & Actions */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Live Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>{isPaused ? 'STREAM PAUSED' : 'LIVE STREAMING'}</span>
              <span className="text-emerald-600 font-mono font-normal">({packetCount} packets)</span>
            </div>

            {/* Pause / Resume */}
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                isPaused 
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              {isPaused ? 'Resume' : 'Pause'}
            </button>

            {/* Clear stream */}
            <button
              onClick={() => {
                setPackets([]);
                setLatestData(null);
                setPacketCount(0);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-500" />
              Clear
            </button>

            {/* View Raw Hex Button */}
            <button
              onClick={() => openInspector(packets[0] || null)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              Latest Raw Hex
            </button>
          </div>

        </div>
      </div>

      {/* ── 6 CATEGORY DIAGNOSTIC CARDS (2-COLUMN STRUCTURE) ──────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        
        {/* CARD 1: ⛽ FUEL INTELLIGENCE */}
        <DiagnosticCard
          title="Fuel Intelligence"
          icon={<Fuel className="w-5 h-5 text-emerald-600" />}
          accentColor="emerald"
          badge={latestData?.fuelRemainingL ? `${latestData.fuelRemainingL} L` : 'Live ECU'}
        >
          <DataRow label="Tank Fuel Remaining" value={formatNum(latestData?.fuelRemainingL, 'Litres')} highlight />
          <DataRow label="Tank Level Percentage" value={formatNum(latestData?.fuelLevelPct, '%')} />
          <DataRow label="Trip Fuel Consumed" value={formatNum(latestData?.tripFuelL, 'Litres')} />
          <DataRow label="Total Lifetime Fuel" value={formatNum(latestData?.totalFuelL, 'Litres')} highlight />
          <DataRow label="Instant Fuel Burn" value={formatNum(latestData?.instantFuelL100km, 'L/100km')} />
          <DataRow label="Average Fuel Economy" value={formatNum(latestData?.avgFuelL100km, 'L/100km')} />
          <DataRow label="Auxiliary Tank (Tag 02)" value={formatNum(latestData?.auxFuelL, 'Litres')} />
          <DataRow label="Fuel Rail Pressure" value={formatNum(latestData?.fuelRailPressureKpa, 'kPa')} />
        </DiagnosticCard>

        {/* CARD 2: ⚙️ ENGINE & ECU DIAGNOSTICS */}
        <DiagnosticCard
          title="Engine & ECU Diagnostics"
          icon={<Gauge className="w-5 h-5 text-indigo-600" />}
          accentColor="indigo"
          badge={latestData?.engineRpm ? `${latestData.engineRpm} RPM` : 'Live CAN'}
        >
          <DataRow label="Engine RPM" value={formatNum(latestData?.engineRpm, 'RPM')} highlight />
          <DataRow label="ECU Wheel Speed" value={formatNum(latestData?.ecuWheelSpeedKmh, 'km/h')} />
          <DataRow label="Throttle / Pedal Position" value={formatNum(latestData?.throttlePct, '%')} />
          <DataRow label="Calculated Engine Load" value={formatNum(latestData?.engineLoadPct, '%')} />
          <DataRow label="Coolant Temperature" value={formatNum(latestData?.coolantTempC, '°C')} highlight />
          <DataRow label="Intake Air Temperature" value={formatNum(latestData?.intakeAirTempC, '°C')} />
          <DataRow label="Manifold Pressure (MAP)" value={formatNum(latestData?.manifoldPressureKpa, 'kPa')} />
          <DataRow label="Mass Air Flow (MAF)" value={formatNum(latestData?.mafGps, 'g/s')} />
        </DiagnosticCard>

        {/* CARD 3: 🔋 BATTERY & ELECTRICAL SYSTEMS */}
        <DiagnosticCard
          title="Battery & Electrical"
          icon={<BatteryCharging className="w-5 h-5 text-amber-600" />}
          accentColor="amber"
          badge={latestData?.batteryVoltageV ? `${latestData.batteryVoltageV} V` : 'Power'}
        >
          <DataRow label="Alternator / Battery Voltage" value={formatNum(latestData?.batteryVoltageV, 'V')} highlight />
          <DataRow label="OBD Port Voltage" value={formatNum(latestData?.obdVoltageV, 'V')} />
          <DataRow label="Backup Battery Health" value={formatNum(latestData?.backupBatteryPct, '%')} />
          <DataRow label="Charging State" value={latestData?.chargingState || 'Normal'} badge={latestData?.batteryVoltageV > 13.0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'} />
          <DataRow label="Power Cut Alert" value="Normal (Connected)" />
          <DataRow label="Ignition ACC State" value={latestData?.ignition ? 'IGNITION ON' : 'IGNITION OFF'} badge={latestData?.ignition ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'} />
        </DiagnosticCard>

        {/* CARD 4: ⏱️ MILEAGE, RUN TIME & TIMERS */}
        <DiagnosticCard
          title="Mileage & Run Time"
          icon={<Clock className="w-5 h-5 text-cyan-600" />}
          accentColor="cyan"
          badge={latestData?.clusterOdometerKm ? `${latestData.clusterOdometerKm} km` : 'Odometers'}
        >
          <DataRow label="Cluster Total Odometer" value={formatNum(latestData?.clusterOdometerKm, 'km')} highlight />
          <DataRow label="GPS Total Odometer" value={formatNum(latestData?.gpsOdometerKm, 'km')} />
          <DataRow label="Current Trip Distance" value={formatNum(latestData?.tripDistanceKm, 'km')} />
          <DataRow label="Total Engine Run Time" value={formatSeconds(latestData?.totalEngineRunTimeSec)} />
          <DataRow label="Engine Idling Duration" value={formatSeconds(latestData?.engineIdleTimeSec)} />
          <DataRow label="Continuous Driving Duration" value={formatSeconds(latestData?.continuousDriveTimeSec)} />
        </DiagnosticCard>

        {/* CARD 5: ⚠️ DRIVER BEHAVIOR & ECU HEALTH */}
        <DiagnosticCard
          title="Driver Behavior & DTC"
          icon={<ShieldAlert className="w-5 h-5 text-rose-600" />}
          accentColor="rose"
          badge={latestData?.dtcCount === 0 ? '0 DTC Codes' : `${latestData?.dtcCount || 0} DTC`}
        >
          <DataRow label="Check Engine (DTC Faults)" value={latestData?.dtcCount !== undefined ? `${latestData.dtcCount} Active Codes` : '0 Active Codes'} badge={latestData?.dtcCount > 0 ? 'bg-rose-100 text-rose-800 font-bold' : 'bg-emerald-50 text-emerald-700 font-semibold'} />
          <DataRow label="Rapid Acceleration Events" value={formatNum(latestData?.rapidAccelCount, 'events')} />
          <DataRow label="Harsh Braking Events" value={formatNum(latestData?.rapidDecelCount, 'events')} />
          <DataRow label="Harsh Cornering Events" value={formatNum(latestData?.harshCornerCount, 'events')} />
          <DataRow label="Chassis VIN Code" value={latestData?.vin || 'Auto-Read from ECU'} />
          <DataRow label="CAN Protocol Standard" value="ISO 15765-4 (CAN 11-bit)" />
        </DiagnosticCard>

        {/* CARD 6: 🛰️ GPS & TELEMETRY */}
        <DiagnosticCard
          title="GPS & Telematics"
          icon={<Navigation className="w-5 h-5 text-sky-600" />}
          accentColor="sky"
          badge={latestData?.satellites ? `${latestData.satellites} Sats` : 'Fix Status'}
        >
          <DataRow label="GPS Fix Status" value={latestData?.gpsValid ? '3D Valid Fix' : 'No Fix'} badge={latestData?.gpsValid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'} />
          <DataRow label="GPS Ground Speed" value={formatNum(latestData?.gpsSpeedKmh, 'km/h')} highlight />
          <DataRow label="GNSS Satellites Tracked" value={formatNum(latestData?.satellites, 'Satellites')} />
          <DataRow label="Cellular Signal (RSSI)" value={latestData?.gsmSignal !== null && latestData?.gsmSignal !== undefined ? `${latestData.gsmSignal} / 31` : '—'} />
          <DataRow label="Coordinates (Lat, Lng)" value={latestData?.lat && latestData?.lng ? `${latestData.lat}, ${latestData.lng}` : '—'} />
          <DataRow label="Heading & Altitude" value={latestData?.headingDeg !== null && latestData?.headingDeg !== undefined ? `${latestData.headingDeg}° (${latestData.altitudeM || 0}m)` : '—'} />
          <DataRow label="Device UTC Timestamp" value={latestData?.deviceTimeStr || '—'} />
        </DiagnosticCard>

      </div>

      {/* ── LIVE PACKETS STREAM HISTORY ─────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Live Incoming Packets Ring Buffer</h2>
            <p className="text-xs text-slate-500">Capped at the latest 50 live packets for maximum performance</p>
          </div>
          <span className="text-xs font-medium px-2 py-1 rounded bg-slate-100 text-slate-600">
            {packets.length} buffered
          </span>
        </div>

        {packets.length === 0 ? (
          <div className="py-12 text-center">
            <Radio className="w-10 h-10 text-slate-300 mx-auto mb-3 animate-pulse" />
            <p className="text-sm font-semibold text-slate-700">Waiting for live packets from {selectedVehicle?.plate || selectedVehicle?.imei || 'device'}...</p>
            <p className="text-xs text-slate-400 mt-1">Packets will appear here in real time as the OBD tracker transmits.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Msg Type</th>
                  <th className="py-3 px-4">RPM</th>
                  <th className="py-3 px-4">Speed</th>
                  <th className="py-3 px-4">Voltage</th>
                  <th className="py-3 px-4">Tank Fuel</th>
                  <th className="py-3 px-4">Total Fuel</th>
                  <th className="py-3 px-4">Coolant</th>
                  <th className="py-3 px-4">Satellites</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {packets.map((pkt, idx) => {
                  const d = pkt.data || {};
                  return (
                    <tr key={pkt.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {pkt.time ? pkt.time.toLocaleTimeString() : '—'}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          d.packetType === 'LOCATION_OBD' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {d.packetType || 'PACKET'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-900">
                        {d.engineRpm ? `${d.engineRpm} RPM` : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-900">
                        {d.gpsSpeedKmh !== null && d.gpsSpeedKmh !== undefined ? `${d.gpsSpeedKmh} km/h` : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-700">
                        {d.batteryVoltageV ? `${d.batteryVoltageV} V` : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-emerald-700">
                        {d.fuelRemainingL ? `${d.fuelRemainingL} L` : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-indigo-700">
                        {d.totalFuelL ? `${d.totalFuelL} L` : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-700">
                        {d.coolantTempC !== null && d.coolantTempC !== undefined ? `${d.coolantTempC} °C` : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">
                        {d.satellites || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => openInspector(pkt)}
                          className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors"
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
      {isHexModalOpen && selectedPacket && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 relative">
            <button
              onClick={() => setIsHexModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Raw Hexadecimal Packet Inspector</h3>
                <p className="text-xs text-slate-500">
                  Length: {(selectedPacket.rawHex?.length / 2) || 0} Bytes | Captured at {selectedPacket.time?.toLocaleTimeString()}
                </p>
              </div>
            </div>

            {/* Raw Hex Display Box */}
            <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-emerald-400 break-all leading-relaxed select-all mb-4 max-h-60 overflow-y-auto border border-slate-800">
              {selectedPacket.rawHex || 'No raw hex available'}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-500">JT808 Framing: Starts with 0x7E, Ends with 0x7E</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(selectedPacket.rawHex)}
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
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 border-t-4 ${accentBorders[accentColor] || 'border-t-slate-400'} p-4 flex flex-col justify-between`}>
      <div>
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
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
