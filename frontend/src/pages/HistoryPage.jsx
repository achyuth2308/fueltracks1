import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Calendar, 
  Download, 
  Table, 
  Map, 
  Loader2, 
  AlertTriangle,
  Play
} from 'lucide-react';
import * as vehicleApi from '../api/vehicleApi';
import RouteMap from '../components/map/RouteMap';
import { formatLocalTime } from '../utils/dateUtils';
import { formatSpeed, formatFuel, formatOdometer } from '../utils/formatUtils';

const HistoryPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [vehicle, setVehicle] = useState(null);
  const [points, setPoints] = useState([]);
  const [paginatedPoints, setPaginatedPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Date range defaults: Today (start at 00:00:00 to end at 23:59:59)
  const getTodayRange = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    return {
      start: start.toISOString().slice(0, 16),
      end: end.toISOString().slice(0, 16)
    };
  };

  const todayRange = getTodayRange();
  const [startDate, setStartDate] = useState(todayRange.start);
  const [endDate, setEndDate] = useState(todayRange.end);

  // Table pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);

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

  const fetchRouteHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch complete route path polyline (no pagination)
      const routeRes = await vehicleApi.getVehicleRoute(id, { 
        startDate: new Date(startDate).toISOString(), 
        endDate: new Date(endDate).toISOString() 
      });
      if (routeRes.success) {
        setPoints(routeRes.data);
      }

      // 2. Fetch paginated table logs
      const historyRes = await vehicleApi.getVehicleHistory(id, {
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        page,
        limit
      });
      if (historyRes.success) {
        setPaginatedPoints(historyRes.data);
        if (historyRes.pagination) {
          setTotal(historyRes.pagination.total);
        }
      }
    } catch (err) {
      console.error('Failed to load history logs:', err);
      setError(err.response?.data?.error || 'Failed to fetch history logs');
    } finally {
      setLoading(false);
    }
  };

  // Trigger fetch when dates or tables pages change
  useEffect(() => {
    fetchRouteHistory();
  }, [id, page]);

  const handleQuerySubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchRouteHistory();
  };

  // Export to CSV helper
  const handleExportCSV = () => {
    if (points.length === 0) return;

    const headers = ['Timestamp', 'Latitude', 'Longitude', 'Speed (km/h)', 'Fuel (%)', 'Ignition'];
    const csvRows = [headers.join(',')];

    points.forEach((p) => {
      const row = [
        new Date(p.device_time).toLocaleString(),
        p.lat,
        p.lng,
        p.speed || 0,
        p.fuel !== undefined && p.fuel !== null ? Number(p.fuel).toFixed(1) : 0,
        p.ignition ? 'ON' : 'OFF'
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${vehicle?.name || 'Vehicle'}_GPS_History_${new Date(startDate).toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-slate-950 p-6 space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(`/vehicles/${id}`)}
            className="p-1 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-slate-100">{vehicle?.name || 'Telemetry Log'}</h2>
              <span className="text-[10px] px-2 py-0.5 bg-slate-800/80 border border-slate-700/50 text-slate-400 font-bold rounded">
                Route Tracker
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">{vehicle?.plate} | IMEI: {vehicle?.imei}</p>
          </div>
        </div>

        {/* Datepicker Form */}
        <form onSubmit={handleQuerySubmit} className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-blue-500 focus:outline-none rounded-lg text-slate-200 font-semibold"
            />
            <span className="text-xs text-slate-500">—</span>
            <input
              type="datetime-local"
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
            Query
          </button>
        </form>
      </div>

      {/* Main Split Body: Map view (Top/Left) + Data logs table (Bottom/Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Route Visualizer Map: occupies 2 columns in large layout */}
        <div className="lg:col-span-2 h-[450px] relative">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm z-20">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              <span className="text-xs text-slate-400 font-semibold mt-3">Reconstructing telemetry trail...</span>
            </div>
          )}
          <RouteMap points={points} />
        </div>

        {/* Aggregate panel + Quick actions: 1 column */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2">
              Route Parameters Summary
            </h4>
            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Coordinates Logs Count</span>
                <span className="font-bold text-slate-200 font-mono">{points.length} packets</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Route Start Point</span>
                <span className="font-bold text-slate-200 truncate max-w-[150px] font-mono">
                  {points.length > 0 ? `${Number(points[0].lat).toFixed(4)}, ${Number(points[0].lng).toFixed(4)}` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Route End Point</span>
                <span className="font-bold text-slate-200 truncate max-w-[150px] font-mono">
                  {points.length > 0 ? `${Number(points[points.length - 1].lat).toFixed(4)}, ${Number(points[points.length - 1].lng).toFixed(4)}` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Export to CSV CTA */}
          <button
            onClick={handleExportCSV}
            disabled={points.length === 0}
            className="flex items-center justify-center w-full py-2.5 text-xs font-bold text-blue-400 hover:text-white hover:bg-blue-600/10 disabled:opacity-30 border border-blue-500/20 hover:border-transparent rounded-lg transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 mr-2" />
            <span>Export Route to CSV</span>
          </button>
        </div>
      </div>

      {/* Historical logs table */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center space-x-1.5">
            <Table className="w-4 h-4 text-slate-500" />
            <span>Telemetries Log Records ({total})</span>
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="text-[10px] text-slate-400 uppercase tracking-wider bg-slate-950/60 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Coordinates</th>
                <th className="px-4 py-3">Speed</th>
                <th className="px-4 py-3">Fuel Level</th>
                <th className="px-4 py-3">Odometer</th>
                <th className="px-4 py-3">Ignition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {paginatedPoints.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-slate-500 italic">
                    No logs recorded for this period query.
                  </td>
                </tr>
              ) : (
                paginatedPoints.map((point) => (
                  <tr key={point.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-medium">{formatLocalTime(point.device_time)}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">
                      {Number(point.lat).toFixed(6)}, {Number(point.lng).toFixed(6)}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-100">{formatSpeed(point.speed)}</td>
                    <td className="px-4 py-3 font-bold text-slate-100">{formatFuel(point.fuel)}</td>
                    <td className="px-4 py-3 font-mono">{formatOdometer(point.odometer)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        point.ignition 
                          ? 'bg-green-500/10 text-green-400 border border-green-500/10' 
                          : 'bg-slate-500/10 text-slate-400 border border-slate-500/10'
                      }`}>
                        {point.ignition ? 'ON' : 'OFF'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination buttons */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center text-xs pt-4 border-t border-slate-800">
            <span className="text-slate-400">
              Showing page <strong className="text-slate-200">{page}</strong> of <strong className="text-slate-200">{totalPages}</strong>
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-800 rounded-lg transition-all"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-800 rounded-lg transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
