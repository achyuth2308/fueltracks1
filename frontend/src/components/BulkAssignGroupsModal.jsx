import React, { useState } from 'react';
import { Layers, X, Check, Loader2, Search, CheckCircle2 } from 'lucide-react';
import { bulkAssignGroups } from '../api/vehicleApi';

export default function BulkAssignGroupsModal({ isOpen, onClose, onSuccess, selectedVehicles = [], availableGroups = [] }) {
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState('replace'); // 'replace' | 'append'

  if (!isOpen) return null;

  const toggleGroup = (groupId) => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const selectAll = () => {
    setSelectedGroupIds(availableGroups.map(g => g.id));
  };

  const deselectAll = () => {
    setSelectedGroupIds([]);
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const vehicleIds = selectedVehicles.map(v => v.id);
      const res = await bulkAssignGroups(vehicleIds, selectedGroupIds, mode);
      if (res.success) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        alert(res.error || 'Failed to assign groups.');
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || err.message || 'Failed to assign groups.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredGroups = availableGroups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Assign Groups</h2>
              <p className="text-xs text-slate-500">Applying to {selectedVehicles.length} selected vehicle{selectedVehicles.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          
          {/* Mode Selector */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-2 text-xs">
            <label className="font-semibold text-slate-700">Assignment Mode:</label>
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setMode('replace')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                  mode === 'replace' ? 'bg-orange-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => setMode('append')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                  mode === 'append' ? 'bg-orange-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Add To
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
            />
          </div>

          {/* Quick Select Buttons */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">{selectedGroupIds.length} group{selectedGroupIds.length !== 1 ? 's' : ''} selected</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-orange-600 hover:underline font-bold"
              >
                Select All
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={deselectAll}
                className="text-slate-500 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Group Checkbox List */}
          <div className="max-h-56 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
            {filteredGroups.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                No groups found.
              </div>
            ) : (
              filteredGroups.map(group => {
                const isChecked = selectedGroupIds.includes(group.id);
                return (
                  <label
                    key={group.id}
                    onClick={() => toggleGroup(group.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-orange-50/80 border-orange-300 text-orange-950 font-semibold'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                        isChecked ? 'bg-orange-600 text-white' : 'border border-slate-300 bg-white'
                      }`}>
                        {isChecked && <Check size={12} strokeWidth={3} />}
                      </div>
                      <span className="text-xs">{group.name}</span>
                    </div>
                  </label>
                );
              })
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/20 transition-all cursor-pointer"
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Apply to {selectedVehicles.length} Vehicles
          </button>
        </div>

      </div>
    </div>
  );
}
