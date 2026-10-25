import React, { useState, useEffect } from 'react';
import { X, Loader2, Users, Search } from 'lucide-react';
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
        setOrgId(editingGroup.org_id || '');
        if (editingGroup.vehicles && Array.isArray(editingGroup.vehicles)) {
          setSelectedVehicleIds(new Set(editingGroup.vehicles.map(v => v.id)));
        } else {
          setSelectedVehicleIds(new Set());
        }
      } else {
        setName('');
        setOrgId(orgs && orgs.length > 0 ? orgs[0].id : '');
        setSelectedVehicleIds(new Set());
      }
      setSearchQuery('');
      setError(null);
    }
  }, [isOpen, editingGroup, orgs]);

  // Fetch all vehicles (and fallback to query group vehicles if not already present on editingGroup)
  useEffect(() => {
    if (!isOpen) return;
    
    const fetchVehicles = async () => {
      setVehiclesLoading(true);
      try {
        const res = await vehicleApi.getVehicles();
        if (res.success) {
          setAvailableVehicles(res.data);
          
          if (editingGroup && (!editingGroup.vehicles || editingGroup.vehicles.length === 0)) {
            const groupVehiclesRes = await vehicleApi.getVehicles({ groupId: editingGroup.id });
            if (groupVehiclesRes.success) {
              const groupVehicleIds = groupVehiclesRes.data.map(v => v.id);
              setSelectedVehicleIds(new Set(groupVehicleIds));
            }
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

  const getVehicleLabel = (v) => {
    return v.name || v.metadata?.vehicleId || v.metadata?.regNo || v.metadata?.registrationNumber || v.imei || 'Unnamed Vehicle';
  };

  const filteredVehicles = availableVehicles.filter(v => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const label = getVehicleLabel(v).toLowerCase();
    const imei = (v.imei || '').toLowerCase();
    return label.includes(q) || imei.includes(q);
  });

  const selectedVehicles = filteredVehicles.filter(v => selectedVehicleIds.has(v.id));
  const unselectedVehicles = filteredVehicles.filter(v => !selectedVehicleIds.has(v.id));

  const isAllSelected = filteredVehicles.length > 0 && filteredVehicles.every(v => selectedVehicleIds.has(v.id));

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Group Name is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const resolvedOrgId = editingGroup?.org_id || orgId || (orgs && orgs[0]?.id) || null;
      await onSave({ name: name.trim(), orgId: resolvedOrgId, vehicleIds: Array.from(selectedVehicleIds) });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save group');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '960px',
          background: '#FFFFFF',
          borderRadius: '14px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh'
        }}
        onClick={e => e.stopPropagation()}
      >

        {/* Modal Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 24px',
          borderBottom: '1px solid #F1F5F9'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#FFF7ED',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users size={17} color="#EA580C" />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
              {editingGroup ? 'Edit Group' : 'Create New Group'}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              borderRadius: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{
          padding: '16px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          flex: 1,
          overflow: 'hidden'
        }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: 600,
              background: '#FEF2F2',
              color: '#DC2626',
              border: '1px solid #FEE2E2',
              borderRadius: '8px'
            }}>
              {error}
            </div>
          )}

          {/* Group Name Input */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 800,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '5px'
            }}>
              Group Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. MADHU or North Zone Fleet"
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: '13px',
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                color: '#0F172A',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
          
          {/* Controls Bar: Select All + Search */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '10px',
            borderBottom: '1px solid #F1F5F9',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              userSelect: 'none'
            }}>
              <input 
                type="checkbox" 
                checked={isAllSelected}
                onChange={handleSelectAll}
                style={{ width: '16px', height: '16px', accentColor: '#EA580C', cursor: 'pointer' }}
              />
              <span>Select all Vehicles</span>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
                ({selectedVehicleIds.size} / {availableVehicles.length} selected)
              </span>
            </label>
            
            {/* Search Input Box */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input 
                type="text"
                placeholder="Search vehicles..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '220px',
                  padding: '7px 12px',
                  fontSize: '12px',
                  border: '1px solid #CBD5E1',
                  borderRight: 'none',
                  borderTopLeftRadius: '6px',
                  borderBottomLeftRadius: '6px',
                  outline: 'none',
                  color: '#0F172A',
                  background: '#FFFFFF'
                }}
              />
              <button
                type="button"
                style={{
                  padding: '7px 12px',
                  background: '#EA580C',
                  color: '#FFFFFF',
                  border: '1px solid #EA580C',
                  borderTopRightRadius: '6px',
                  borderBottomRightRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Search size={14} />
              </button>
            </div>
          </div>

          {/* Main Scrollable Vehicle Sections Container */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            paddingRight: '6px'
          }}>
            {vehiclesLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
                <Loader2 size={26} className="animate-spin" color="#EA580C" />
              </div>
            ) : (
              <>
                {/* SECTION 1: SELECTED VEHICLES */}
                <div>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#EA580C',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span>Selected Vehicles :</span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#C2410C',
                      background: '#FFEDD5',
                      padding: '1px 8px',
                      borderRadius: '10px'
                    }}>
                      {selectedVehicles.length}
                    </span>
                  </div>

                  {selectedVehicles.length === 0 ? (
                    <div style={{
                      padding: '12px 14px',
                      background: '#F8FAFC',
                      borderRadius: '8px',
                      border: '1px dashed #CBD5E1',
                      color: '#64748B',
                      fontSize: '12px',
                      fontStyle: 'italic'
                    }}>
                      No vehicles selected yet. Check any vehicle below to select it.
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                      gap: '8px'
                    }}>
                      {selectedVehicles.map((v) => {
                        const label = getVehicleLabel(v);
                        return (
                          <label
                            key={v.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 10px',
                              border: '1px solid #FDBA74',
                              background: '#FFF7ED',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              userSelect: 'none',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={true}
                              onChange={() => handleCheckboxChange(v.id)}
                              style={{ width: '15px', height: '15px', accentColor: '#EA580C', cursor: 'pointer' }}
                            />
                            <span
                              title={label}
                              style={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                color: '#9A3412',
                                fontWeight: 700
                              }}
                            >
                              {label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* SECTION 2: SELECT THE VEHICLES (AVAILABLE / UNSELECTED) */}
                <div>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#EA580C',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span>Select the Vehicles :</span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      background: '#F1F5F9',
                      padding: '1px 8px',
                      borderRadius: '10px'
                    }}>
                      {unselectedVehicles.length}
                    </span>
                  </div>

                  {unselectedVehicles.length === 0 ? (
                    <div style={{
                      padding: '12px 14px',
                      background: '#F8FAFC',
                      borderRadius: '8px',
                      border: '1px dashed #CBD5E1',
                      color: '#64748B',
                      fontSize: '12px',
                      fontStyle: 'italic'
                    }}>
                      {selectedVehicles.length > 0 ? 'All available vehicles are currently selected.' : 'No vehicles found matching search.'}
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                      gap: '8px'
                    }}>
                      {unselectedVehicles.map((v) => {
                        const label = getVehicleLabel(v);
                        return (
                          <label
                            key={v.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 10px',
                              border: '1px solid #E2E8F0',
                              background: '#FFFFFF',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              userSelect: 'none',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = '#FDBA74';
                              e.currentTarget.style.background = '#FFFAF5';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = '#E2E8F0';
                              e.currentTarget.style.background = '#FFFFFF';
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={false}
                              onChange={() => handleCheckboxChange(v.id)}
                              style={{ width: '15px', height: '15px', accentColor: '#EA580C', cursor: 'pointer' }}
                            />
                            <span
                              title={label}
                              style={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                color: '#1E293B',
                                fontWeight: 600
                              }}
                            >
                              {label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer Action Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #F1F5F9'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#64748B',
                background: '#F1F5F9',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 24px',
                fontSize: '13px',
                fontWeight: 700,
                color: '#FFFFFF',
                background: '#EA580C',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)'
              }}
            >
              {loading && <Loader2 size={14} style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }} />}
              {editingGroup ? 'Update Group' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddGroupModal;

