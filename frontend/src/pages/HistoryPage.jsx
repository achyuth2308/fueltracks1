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
    <div className="flex flex-col min-h-[calc(100vh-4rem)] p-6 space-y-6" style={{ background: 'linear-gradient(to bottom, #FFF7ED 0%, #FFF7ED 50%, #F8FAFC 50%, #F8FAFC 100%)' }}>
      {/* Header bar */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 pb-4 border-b border-orange-200">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(`/vehicles/${id}`)}
            className="p-1.5 text-orange-600 hover:text-white hover:bg-orange-500 bg-white border border-orange-200 rounded-lg shadow-sm transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-extrabold" style={{ color: '#000000' }}>{vehicle?.name || 'Telemetry Log'}</h2>
            </div>
            <p className="text-xs font-bold text-slate-700 mt-0.5">{vehicle?.plate} | IMEI: {vehicle?.imei}</p>
          </div>
        </div>

        {/* Datepicker Form */}
        <form onSubmit={handleQuerySubmit} className="flex flex-col sm:flex-row flex-wrap items-center gap-5">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Calendar className="w-5 h-5 text-orange-600 hidden sm:block" />
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-orange-300 hover:border-orange-400 focus:border-orange-600 focus:ring-2 focus:ring-orange-600/20 focus:outline-none rounded-lg text-black font-bold shadow-sm transition-all"
            />
            <span className="text-xs font-extrabold text-black">—</span>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-orange-300 hover:border-orange-400 focus:border-orange-600 focus:ring-2 focus:ring-orange-600/20 focus:outline-none rounded-lg text-black font-bold shadow-sm transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 rounded-lg shadow-md transition-all cursor-pointer ml-2"
          >
            Query
          </button>
        </form>
      </div>

      {/* Main Split Body: Map view (Top/Left) + Data logs table (Bottom/Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Route Visualizer Map: occupies 2 columns in large layout */}
        <div className="lg:col-span-2 h-[450px] relative rounded-xl overflow-hidden border border-orange-200 shadow-sm bg-white">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-20">
              <Loader2 className="w-6 h-6 text-orange-600 animate-spin" />
              <span className="text-sm text-black font-bold mt-3">Reconstructing telemetry trail...</span>
            </div>
          )}
          <RouteMap points={points} />
        </div>

        {/* Aggregate panel + Quick actions: 1 column */}
        <div className="p-5 bg-white border border-orange-200 shadow-sm rounded-xl flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <h4 className="text-base font-extrabold uppercase tracking-wide border-b border-orange-200 pb-3 flex items-center gap-2" style={{ color: '#000000' }}>
              <Map className="w-5 h-5 text-orange-600" />
              Route Parameters Summary
            </h4>
            <div className="flex flex-col text-sm mt-4 divide-y divide-orange-100">
              <div className="flex justify-between items-center py-4">
                <span className="font-bold text-black">Coordinates Logs Count</span>
                <span className="font-bold text-black font-mono bg-orange-50 px-2 py-1 rounded border border-orange-100">{points.length} packets</span>
              </div>
              <div className="flex justify-between items-center py-4">
                <span className="font-bold text-black">Route Start Point</span>
                <span className="font-bold text-black truncate max-w-[150px] font-mono bg-orange-50 px-2 py-1 rounded border border-orange-200">
                  {points.length > 0 ? `${Number(points[0].lat).toFixed(4)}, ${Number(points[0].lng).toFixed(4)}` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center py-4">
                <span className="font-bold text-black">Route End Point</span>
                <span className="font-bold text-black truncate max-w-[150px] font-mono bg-orange-50 px-2 py-1 rounded border border-orange-200">
                  {points.length > 0 ? `${Number(points[points.length - 1].lat).toFixed(4)}, ${Number(points[points.length - 1].lng).toFixed(4)}` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Export to CSV CTA */}
          <button
            onClick={handleExportCSV}
            disabled={points.length === 0}
            className="flex items-center justify-center w-full py-3 text-sm font-bold text-white-50 bg-orange-500 hover:bg-orange-700 disabled:opacity-60 border border-transparent rounded-lg transition-all cursor-pointer shadow-md"
          >
            <Download className="w-5 h-5 mr-2" />
            <span>Export Route to CSV</span>
          </button>
        </div>
      </div>

      {/* Historical logs table */}
      <div className="p-5 bg-white border border-orange-600 shadow-sm rounded-xl space-y-4">
        <div className="flex justify-between items-center border-b border-orange-200 pb-4">
          <h4 className="text-base font-extrabold uppercase tracking-wide flex items-center space-x-2" style={{ color: '#000000' }}>
            <Table className="w-5 h-5 text-violet-600" />
            <span>Telemetries Log Records ({total})</span>
          </h4>
        </div>

        <div className="overflow-x-auto rounded-lg border border-orange-200 bg-white">
          <table className="w-full text-sm text-left text-black">
            <thead className="text-[11px] font-extrabold text-orange-900 uppercase tracking-wider bg-orange-100 border-b border-orange-200">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Coordinates</th>
                <th className="px-4 py-3">Speed</th>
                <th className="px-4 py-3">Fuel Level</th>
                <th className="px-4 py-3">Odometer</th>
                <th className="px-4 py-3">Ignition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-100">
              {paginatedPoints.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-black font-semibold italic">
                    No logs recorded for this period query.
                  </td>
                </tr>
              ) : (
                paginatedPoints.map((point) => (
                  <tr key={point.id} className="hover:bg-orange-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-black">{formatLocalTime(point.device_time)}</td>
                    <td className="px-4 py-3 font-mono font-bold text-black">
                      {Number(point.lat).toFixed(6)}, {Number(point.lng).toFixed(6)}
                    </td>
                    <td className="px-4 py-3 font-extrabold text-black">{formatSpeed(point.speed)}</td>
                    <td className="px-4 py-3 font-extrabold text-black">{formatFuel(point.fuel)}</td>
                    <td className="px-4 py-3 font-mono font-bold text-black">{formatOdometer(point.odometer)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] border ${point.ignition
                        ? 'bg-green-100 text-green-800 border-green-300'
                        : 'bg-orange-100 text-orange-800 border-orange-300'
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
          <div className="flex justify-between items-center text-sm pt-4 border-t border-orange-200">
            <span className="font-bold text-black">
              Showing page <strong className="text-black">{page}</strong> of <strong className="text-black">{totalPages}</strong>
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-white hover:bg-orange-50 disabled:opacity-40 border border-orange-200 text-black font-bold rounded-lg shadow-sm transition-all"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 bg-white hover:bg-orange-50 disabled:opacity-40 border border-orange-200 text-black font-bold rounded-lg shadow-sm transition-all"
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
