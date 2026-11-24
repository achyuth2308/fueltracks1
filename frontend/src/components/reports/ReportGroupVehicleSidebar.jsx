import React, { useState, useMemo, useEffect } from 'react';
import { Search, MapPin, ChevronDown, ChevronRight, Car, X, Layers } from 'lucide-react';

/**
 * ReportGroupVehicleSidebar
 * 
 * Reusable accordion sidebar for report pages matching legacy GPS reports:
 * - Search bar at top
 * - Accordion list of vehicle groups with blue location pins
 * - Single group expansion: clicking one group opens it and closes all other groups
 * - Vehicles inside expanded group with car icon and active selection styling
 * - Optional showAllOption for consolidated/fleet-wide reports
 */
const ReportGroupVehicleSidebar = ({
  vehicles = [],
  selectedVehicleId = '',
  selectedGroupId = '',
  onSelectVehicle,
  onSelectGroup,
  showAllOption = false,
  width = '175px',
  style = {}
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [openGroupId, setOpenGroupId] = useState(null);

  // Group vehicles by their assigned group
  const groupMap = useMemo(() => {
    const map = new Map();
    const ungroupedKey = '__ungrouped__';

    vehicles.forEach(v => {
      // Extract group names (support comma-separated or array or object)
      let groupNames = [];
      if (Array.isArray(v.groups) && v.groups.length > 0) {
        groupNames = v.groups.map(g => (typeof g === 'string' ? g : g.name)).filter(Boolean);
      } else if (v.group_name) {
        groupNames = v.group_name.split(',').map(s => s.trim()).filter(Boolean);
      } else if (v.group?.name) {
        groupNames = [v.group.name.trim()];
      }

      if (groupNames.length === 0) {
        if (!map.has(ungroupedKey)) {
          map.set(ungroupedKey, { id: ungroupedKey, name: 'General Fleet', vehicles: [] });
        }
        map.get(ungroupedKey).vehicles.push(v);
      } else {
        groupNames.forEach(gn => {
          const key = gn.toLowerCase();
          if (!map.has(key)) {
            map.set(key, { id: key, name: gn, vehicles: [] });
          }
          // Avoid duplicate within the same group
          const list = map.get(key).vehicles;
          if (!list.some(existing => existing.id === v.id)) {
            list.push(v);
          }
        });
      }
    });

    const groupsArr = [];
    let ungroupedGroup = null;

    for (const [key, grp] of map.entries()) {
      if (key === ungroupedKey) {
        ungroupedGroup = grp;
      } else {
        groupsArr.push(grp);
      }
    }

    // Sort named groups alphabetically
    groupsArr.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    // Append ungrouped at the end if it exists
    if (ungroupedGroup && ungroupedGroup.vehicles.length > 0) {
      // If there are no named groups at all, rename to "All Vehicles"
      if (groupsArr.length === 0) {
        ungroupedGroup.name = 'All Vehicles';
      }
      groupsArr.push(ungroupedGroup);
    }

    return groupsArr;
  }, [vehicles]);

  // Auto-expand group that contains the selectedVehicleId on initial load or change
  useEffect(() => {
    if (!selectedVehicleId) return;
    for (const grp of groupMap) {
      if (grp.vehicles.some(v => String(v.id) === String(selectedVehicleId))) {
        setOpenGroupId(prev => (prev === null ? grp.id : prev));
        break;
      }
    }
  }, [selectedVehicleId, groupMap]);

  // Filter groups and vehicles based on search query
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groupMap;

    return groupMap
      .map(grp => {
        const matchingVehicles = grp.vehicles.filter(v => {
          const nameMatch = (v.name || '').toLowerCase().includes(q);
          const plateMatch = (v.plate || '').toLowerCase().includes(q);
          return nameMatch || plateMatch;
        });
        const groupNameMatch = grp.name.toLowerCase().includes(q);

        if (groupNameMatch) {
          return grp;
        }
        if (matchingVehicles.length > 0) {
          return { ...grp, vehicles: matchingVehicles };
        }
        return null;
      })
      .filter(Boolean);
  }, [groupMap, searchQuery]);

  // When searching, auto-expand the first group with matches
  useEffect(() => {
    if (searchQuery.trim() && filteredGroups.length > 0) {
      setOpenGroupId(filteredGroups[0].id);
    }
  }, [searchQuery, filteredGroups]);

  // Toggle group accordion (closes any other open group)
  const handleToggleGroup = (groupId) => {
    setOpenGroupId(prev => (prev === groupId ? null : groupId));
  };

  return (
    <div
      style={{
        width,
        minWidth: '150px',
        maxWidth: '220px',
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '6px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        overflow: 'hidden',
        height: '100%',
        flexShrink: 0,
        fontFamily: "'Inter', system-ui, sans-serif",
        ...style
      }}
    >
      {/* ── Top Search Input ── */}
      <div
        style={{
          padding: '6px 8px',
          borderBottom: '1px solid #E2E8F0',
          background: '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          gap: '5px'
        }}
      >
        <Search size={12} color="#64748B" style={{ flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: '11px',
            color: '#0F172A',
            padding: 0
          }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              color: '#94A3B8'
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* ── Accordion Groups List ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          background: '#FFFFFF'
        }}
      >
        {/* Optional 'All Vehicles' row for consolidated / fleet-wide view */}
        {showAllOption && (
          <div
            onClick={() => {
              if (onSelectGroup) onSelectGroup('All');
              if (onSelectVehicle) onSelectVehicle('', { isAll: true });
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px',
              margin: '4px 6px',
              borderRadius: '4px',
              cursor: 'pointer',
              background: (!selectedVehicleId && (!selectedGroupId || selectedGroupId === 'All')) ? '#EFF6FF' : '#F8FAFC',
              border: (!selectedVehicleId && (!selectedGroupId || selectedGroupId === 'All')) ? '1px solid #3B82F6' : '1px solid #E2E8F0',
              color: (!selectedVehicleId && (!selectedGroupId || selectedGroupId === 'All')) ? '#1D4ED8' : '#334155',
              fontSize: '11px',
              fontWeight: 700,
              transition: 'all 0.15s ease'
            }}
            title={`Select all vehicles in fleet (${vehicles.length})`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Layers size={12} color={(!selectedVehicleId && (!selectedGroupId || selectedGroupId === 'All')) ? '#2563EB' : '#64748B'} />
              <span>All Vehicles</span>
            </div>
            <span style={{ fontSize: '9.5px', color: '#64748B', fontWeight: 600 }}>({vehicles.length})</span>
          </div>
        )}
        {filteredGroups.length === 0 ? (
          <div style={{ padding: '16px 8px', textAlign: 'center', color: '#94A3B8', fontSize: '11px' }}>
            No matching groups
          </div>
        ) : (
          filteredGroups.map(grp => {
            const isOpen = openGroupId === grp.id;
            const hasSelectedVehicle = grp.vehicles.some(
              v => String(v.id) === String(selectedVehicleId)
            );

            return (
              <div key={grp.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                {/* Group Header Button */}
                <div
                  onClick={() => handleToggleGroup(grp.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 8px',
                    cursor: 'pointer',
                    background: isOpen ? '#F0F9FF' : (hasSelectedVehicle ? '#F8FAFC' : '#FFFFFF'),
                    borderLeft: isOpen
                      ? '3px solid #0284C7'
                      : (hasSelectedVehicle ? '3px solid #93C5FD' : '3px solid transparent'),
                    transition: 'all 0.15s ease',
                    userSelect: 'none'
                  }}
                  onMouseEnter={e => {
                    if (!isOpen) e.currentTarget.style.background = '#F8FAFC';
                  }}
                  onMouseLeave={e => {
                    if (!isOpen) {
                      e.currentTarget.style.background = hasSelectedVehicle ? '#F8FAFC' : '#FFFFFF';
                    }
                  }}
                  title={`${grp.name} (${grp.vehicles.length} vehicles)`}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      overflow: 'hidden',
                      minWidth: 0
                    }}
                  >
                    <MapPin size={13} color="#0284C7" style={{ flexShrink: 0 }} />
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: isOpen ? '#0369A1' : '#0F172A',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        letterSpacing: '0.02em'
                      }}
                    >
                      {grp.name}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: '9.5px',
                        fontWeight: 600,
                        color: isOpen ? '#0284C7' : '#94A3B8'
                      }}
                    >
                      {grp.vehicles.length}
                    </span>
                    {isOpen ? (
                      <ChevronDown size={13} color="#0284C7" />
                    ) : (
                      <ChevronRight size={13} color="#94A3B8" />
                    )}
                  </div>
                </div>

                {/* Expanded Vehicles in Group */}
                {isOpen && (
                  <div
                    style={{
                      background: '#F8FAFC',
                      padding: '3px 4px 5px 6px',
                      borderTop: '1px solid #E2E8F0',
                      borderBottom: '1px solid #E2E8F0'
                    }}
                  >
                    {/* Optional All in Group selector */}
                    {showAllOption && (
                      <div
                        onClick={() => {
                          if (onSelectGroup) onSelectGroup(grp.name, grp);
                          if (onSelectVehicle) onSelectVehicle('', { isAllInGroup: true, groupName: grp.name, group: grp });
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '5px',
                          padding: '4px 6px',
                          margin: '2px 0 4px 0',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          background: (!selectedVehicleId && selectedGroupId === grp.name) ? '#EFF6FF' : '#FFFFFF',
                          border: (!selectedVehicleId && selectedGroupId === grp.name) ? '1px solid #3B82F6' : '1px dashed #CBD5E1',
                          color: (!selectedVehicleId && selectedGroupId === grp.name) ? '#1D4ED8' : '#475569',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          transition: 'all 0.12s ease'
                        }}
                        title={`Select all vehicles in ${grp.name} (${grp.vehicles.length})`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
                          <Layers size={11} color={(!selectedVehicleId && selectedGroupId === grp.name) ? '#2563EB' : '#64748B'} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            All in {grp.name}
                          </span>
                        </div>
                        <span style={{ fontSize: '9.5px', opacity: 0.85 }}>({grp.vehicles.length})</span>
                      </div>
                    )}
                    {grp.vehicles.length === 0 ? (
                      <div style={{ padding: '6px 8px', fontSize: '10.5px', color: '#94A3B8' }}>
                        No vehicles in this group
                      </div>
                    ) : (
                      grp.vehicles.map(v => {
                        const isSelected = String(v.id) === String(selectedVehicleId);
                        const isOnline =
                          v.online ||
                          v.is_online ||
                          v.status === 'Running' ||
                          v.status === 'Idle' ||
                          (v.speed && v.speed > 0) ||
                          v.ignition;

                        return (
                          <div
                            key={v.id}
                            onClick={() => onSelectVehicle && onSelectVehicle(v.id, v)}
                            title={`${v.name || ''} ${v.plate ? `(${v.plate})` : ''}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '5px',
                              padding: '5px 7px',
                              margin: '2px 0',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              background: isSelected ? '#FEF2F2' : '#FFFFFF',
                              border: isSelected ? '1px solid #FCA5A5' : '1px solid #E2E8F0',
                              boxShadow: isSelected
                                ? '0 1px 2px rgba(239, 68, 68, 0.1)'
                                : '0 1px 2px rgba(0,0,0,0.02)',
                              transition: 'all 0.12s ease'
                            }}
                            onMouseEnter={e => {
                              if (!isSelected) {
                                e.currentTarget.style.background = '#F1F5F9';
                                e.currentTarget.style.borderColor = '#CBD5E1';
                              }
                            }}
                            onMouseLeave={e => {
                              if (!isSelected) {
                                e.currentTarget.style.background = '#FFFFFF';
                                e.currentTarget.style.borderColor = '#E2E8F0';
                              }
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                overflow: 'hidden',
                                minWidth: 0
                              }}
                            >
                              <Car
                                size={12}
                                color={isSelected ? '#EF4444' : (isOnline ? '#10B981' : '#64748B')}
                                style={{ flexShrink: 0 }}
                              />
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: isSelected ? 700 : 500,
                                  color: isSelected ? '#B91C1C' : '#334155',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {v.name || v.plate}
                              </span>
                            </div>

                            {/* Online / Offline status indicator dot */}
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: isOnline ? '#10B981' : '#CBD5E1',
                                flexShrink: 0
                              }}
                              title={isOnline ? 'Online' : 'Offline'}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ReportGroupVehicleSidebar;
