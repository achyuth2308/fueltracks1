import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Calendar, 
  Printer, 
  TrendingUp, 
  Gauge, 
  Activity, 
  Fuel, 
  Loader2, 
  AlertTriangle 
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
import * as vehicleApi from '../../api/vehicleApi';
import { formatLocalTime, formatLocalDate } from '../../utils/dateUtils';
import { formatSpeed, formatFuel } from '../../utils/formatUtils';

const ReportPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [vehicle, setVehicle] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Defaults: last 7 days
  const getLastWeekRange = () => {
    const today = new Date();
    const start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      start: start.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    };
  };

  const initRange = getLastWeekRange();
  const [startDate, setStartDate] = useState(initRange.start);
  const [endDate, setEndDate] = useState(initRange.end);

  useEffect(() => {
    const fetchVehicle = async () => {
      try {
        const response = await vehicleApi.getVehicleById(id);
        if (response.success) {
          setVehicle(response.data);
        }
      } catch (err) {
        console.error('Failed to fetch vehicle:', err);
      }
    };
    fetchVehicle();
  }, [id]);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await vehicleApi.getVehicleReport(id, { startDate, endDate });
      if (response.success) {
        setDailyData(response.data.daily || []);
        setSummary(response.data.summary || null);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
      setError(err.response?.data?.error || 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [id]);

  const handleQuery = (e) => {
    e.preventDefault();
    fetchReports();
  };

  const handlePrint = () => {
    window.print();
  };

  // Recharts styling tokens
  const gridStroke = '#1e293b'; // slate-800
  const axisColor = '#94a3b8'; // slate-400

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-slate-950 p-6 space-y-6 print:bg-white print:text-slate-900 print:p-0">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800 print:hidden">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(`/vehicles/${id}`)}
            className="p-1 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-bold text-slate-100">{vehicle?.name || 'Analytics Reports'}</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">{vehicle?.plate} | IMEI: {vehicle?.imei}</p>
          </div>
        </div>

        {/* Datepicker Form */}
        <form onSubmit={handleQuery} className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-blue-500 focus:outline-none rounded-lg text-slate-200 font-semibold"
            />
            <span className="text-xs text-slate-500">—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-blue-500 focus:outline-none rounded-lg text-slate-200 font-semibold"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg shadow transition-all cursor-pointer"
          >
            Generate
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center px-3.5 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            <span>Print / PDF</span>
          </button>
        </form>
      </div>

      {/* Print only header */}
      <div className="hidden print:block border-b border-slate-300 pb-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">FuelTracks Fleet Report</h1>
        <p className="text-xs text-slate-600">Vehicle: {vehicle?.name} ({vehicle?.plate}) | IMEI: {vehicle?.imei}</p>
        <p className="text-xs text-slate-600">Date Range: {startDate} to {endDate}</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-xs text-slate-400 font-semibold mt-3">Compiling reports analytics...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
          <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <h5 className="font-bold text-slate-200 text-sm">Reports Generation Failed</h5>
          <p className="text-xs text-slate-400 mt-1">{error}</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Distance Travelled</p>
              <h3 className="text-xl font-bold text-slate-100 font-mono">
                {summary?.total_distance ? `${parseFloat(summary.total_distance).toFixed(1)} km` : '0.0 km'}
              </h3>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <Gauge className="w-5 h-5 text-green-500" />
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Average Speed</p>
              <h3 className="text-xl font-bold text-slate-100 font-mono">
                {summary?.avg_speed ? formatSpeed(Math.round(summary.avg_speed)) : '0 km/h'}
              </h3>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <Activity className="w-5 h-5 text-red-500" />
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Peak Speed</p>
              <h3 className="text-xl font-bold text-slate-100 font-mono">
                {summary?.max_speed ? formatSpeed(summary.max_speed) : '0 km/h'}
              </h3>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <Fuel className="w-5 h-5 text-amber-500" />
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Fuel Variance</p>
              <h3 className="text-xl font-bold text-slate-100 font-mono">
                {summary?.min_fuel && summary?.max_fuel 
                  ? `${(parseFloat(summary.max_fuel) - parseFloat(summary.min_fuel)).toFixed(1)}%` 
                  : '0.0%'}
              </h3>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:block print:space-y-6">
            {/* Speed progression chart */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4 print:border-slate-300">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-850 pb-2">
                Velocity Log Analytics (km/h)
              </h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="date" stroke={axisColor} fontSize={10} tickFormatter={formatLocalDate} />
                    <YAxis stroke={axisColor} fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                    <Legend />
                    <Line type="monotone" dataKey="max_speed" name="Peak Speed" stroke="#ef4444" strokeWidth={2.5} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="avg_speed" name="Avg Speed" stroke="#3b82f6" strokeWidth={2.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Fuel drop charts */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4 print:border-slate-300">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-850 pb-2">
                Fuel Levels Tracking (%)
              </h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="date" stroke={axisColor} fontSize={10} tickFormatter={formatLocalDate} />
                    <YAxis stroke={axisColor} fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                    <Legend />
                    <Line type="monotone" dataKey="max_fuel" name="Max Fuel" stroke="#22c55e" strokeWidth={2.5} />
                    <Line type="monotone" dataKey="min_fuel" name="Min Fuel" stroke="#f59e0b" strokeWidth={2.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Daily Distance Bar Chart */}
            <div className="lg:col-span-2 p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4 print:border-slate-300">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-850 pb-2">
                Daily Run Distance (km)
              </h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="date" stroke={axisColor} fontSize={10} tickFormatter={formatLocalDate} />
                    <YAxis stroke={axisColor} fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                    <Legend />
                    <Bar dataKey="distance_km" name="Distance (km)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Table Breakdown */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4 print:border-slate-300">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-850 pb-2">
              Day-by-Day Telemetry Summary
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300 print:text-slate-900">
                <thead className="text-[10px] text-slate-400 uppercase tracking-wider bg-slate-950/60 border-b border-slate-800 print:border-slate-300">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Total Logs</th>
                    <th className="px-4 py-3">Distance</th>
                    <th className="px-4 py-3">Peak Speed</th>
                    <th className="px-4 py-3">Avg Speed</th>
                    <th className="px-4 py-3">Fuel Levels (Max / Min)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 print:divide-slate-300">
                  {dailyData.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-6 text-center text-slate-500 italic">
                        No report history found for the selected query dates.
                      </td>
                    </tr>
                  ) : (
                    dailyData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-bold font-mono">{formatLocalDate(row.date)}</td>
                        <td className="px-4 py-3 font-mono">{row.total_points}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-slate-200">
                          {row.distance_km ? `${parseFloat(row.distance_km).toFixed(1)} km` : '0.0 km'}
                        </td>
                        <td className="px-4 py-3 font-bold text-red-400">{formatSpeed(row.max_speed)}</td>
                        <td className="px-4 py-3 font-mono">{formatSpeed(Math.round(row.avg_speed))}</td>
                        <td className="px-4 py-3 font-mono text-slate-400">
                          <span className="text-green-400 font-bold">{formatFuel(row.max_fuel)}</span> /{' '}
                          <span className="text-amber-400 font-bold">{formatFuel(row.min_fuel)}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportPage;
