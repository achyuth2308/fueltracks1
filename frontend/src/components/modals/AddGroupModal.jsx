import React, { useState, useEffect } from 'react';
import { X, Loader2, Users } from 'lucide-react';
import * as adminApi from '../../api/adminApi';
import * as vehicleApi from '../../api/vehicleApi';

const AddGroupModal = ({ isOpen, onClose, onSave, orgs = [], editingGroup = null }) => {
  const [name, setName] = useState('');
  const [orgId, setOrgId] = useState('');
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicleIds, setSelectedVehicleIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      if (editingGroup) {
        setName(editingGroup.name || '');
        setOrgId(editingGroup.org_id || (orgs.length > 0 ? orgs[0].id : ''));
      } else {
        setName('');
        setOrgId(orgs.length > 0 ? orgs[0].id : '');
      }
      setError(null);
    }
  }, [isOpen, orgs, editingGroup]);

  // Fetch all vehicles (and if editing, pre-select the group's vehicles)
  useEffect(() => {
    if (!isOpen) return;
    
    const fetchVehicles = async () => {
      setVehiclesLoading(true);
      try {
        // Fetch all vehicles
        const res = await vehicleApi.getVehicles();
        if (res.success) {
          // Show all vehicles, do not filter by orgId
          setAvailableVehicles(res.data);
          
          // If editing, we also need to know which vehicles belong to this group to check them initially
          if (editingGroup) {
            const groupVehiclesRes = await vehicleApi.getVehicles({ groupId: editingGroup.id });
            if (groupVehiclesRes.success) {
              const groupVehicleIds = groupVehiclesRes.data.map(v => v.id);
              setSelectedVehicleIds(new Set(groupVehicleIds));
            }
          } else {
            setSelectedVehicleIds(new Set());
          }
        }
      } catch (err) {
        console.error("Failed to load vehicles for group", err);
      } finally {
        setVehiclesLoading(false);
      }
    };

    fetchVehicles();
  }, [isOpen, editingGroup]);

  const handleCheckboxChange = (vehicleId) => {
    const nextSet = new Set(selectedVehicleIds);
    if (nextSet.has(vehicleId)) {
      nextSet.delete(vehicleId);
    } else {
      nextSet.add(vehicleId);
    }
    setSelectedVehicleIds(nextSet);
  };

  const filteredVehicles = availableVehicles.filter(v => 
    (v.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (v.metadata?.vehicleId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.imei || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = filteredVehicles.map(v => v.id);
      setSelectedVehicleIds(new Set([...selectedVehicleIds, ...allIds]));
    } else {
      const nextSet = new Set(selectedVehicleIds);
      filteredVehicles.forEach(v => nextSet.delete(v.id));
      setSelectedVehicleIds(nextSet);
    }
  };

  const isAllSelected = filteredVehicles.length > 0 && filteredVehicles.every(v => selectedVehicleIds.has(v.id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !orgId) {
      setError('Group Name and Organization are required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSave({ name, orgId, vehicleIds: Array.from(selectedVehicleIds) });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(17, 24, 39, 0.6)', backdropFilter: 'blur(4px)', padding: '16px' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: '800px', background: '#FFFFFF', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FFF4ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} color="#FF6B00" />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{editingGroup ? 'Edit Group' : 'Create New Group'}</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflow: 'hidden' }}>
          {error && (
            <div style={{ padding: '12px', fontSize: '13px', fontWeight: 600, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FEE2E2', borderRadius: '8px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '24px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                Group Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. North Zone Fleet"
                style={{ width: '100%', padding: '10px 14px', fontSize: '14px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>


          </div>
          
          {/* Controls Bar: Select All + Search */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', marginBottom: '12px', paddingBottom: '16px', borderBottom: '1px solid #F1F5F9' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#475569' }}>
              <input 
                type="checkbox" 
                checked={isAllSelected}
                onChange={handleSelectAll}
                style={{ width: '16px', height: '16px', accentColor: '#3B82F6', cursor: 'pointer' }}
              />
              Select all Vehicles
            </label>
            
            <input 
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '300px', padding: '10px 14px', fontSize: '14px', border: '1px solid #CBD5E1', borderRadius: '4px', outline: 'none' }}
            />
          </div>

          {/* Vehicle Checklist Grid */}
          <div style={{ marginTop: '8px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#3B82F6', marginBottom: '16px' }}>
              Select the Vehicles:
            </label>
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
              {vehiclesLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                  <Loader2 size={24} className="animate-spin" color="#3B82F6" />
                </div>
              ) : filteredVehicles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#94A3B8', fontSize: '14px' }}>
                  No vehicles match your search.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                  {filteredVehicles.map((v) => (
                    <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', border: '1px solid #E2E8F0', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#000000' }}>
                      <input type="checkbox" checked={selectedVehicleIds.has(v.id)} onChange={() => handleCheckboxChange(v.id)} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#000000' }}>
                        {v.name || v.metadata?.vehicleId || v.imei}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer Save buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 600, color: '#64748B', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 24px', fontSize: '14px', fontWeight: 600, color: '#FFFFFF', background: '#3B82F6', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? <Loader2 size={16} style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }} /> : null}
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddGroupModal;
