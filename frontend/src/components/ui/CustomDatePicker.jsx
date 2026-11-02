import React, { useState, useEffect, useRef, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Clock, ChevronDown, Check, Zap, Calendar } from 'lucide-react';

const formatDisplayTime = (timeStr) => {
  if (!timeStr) return '--:--';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h < 12 ? 'AM' : 'PM';
  const displayH = h === 0 ? 12 : (h > 12 ? h - 12 : h);
  return `${String(displayH).padStart(2, '0')}:${m} ${ampm}`;
};

const CustomDateInput = React.forwardRef(({ value, onClick, placeholder, style }, ref) => {
  const { padding, paddingLeft, ...restStyle } = style || {};
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        ref={ref}
        value={value || ''}
        onClick={onClick}
        readOnly
        placeholder={placeholder || 'Select Date'}
        style={{
          width: '100%',
          padding: '7px 10px 7px 34px',
          borderRadius: '6px',
          border: '1px solid #CBD5E1',
          outline: 'none',
          boxSizing: 'border-box',
          color: '#0F172A',
          fontSize: '13px',
          fontWeight: 500,
          background: '#FAFAFA',
          fontFamily: 'inherit',
          cursor: 'pointer',
          ...restStyle
        }}
      />
      <Calendar
        size={14}
        color="#64748B"
        style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
      />
    </div>
  );
});
CustomDateInput.displayName = 'CustomDateInput';

const CustomDatePicker = ({ 
  value, 
  onChange, 
  style, 
  max, 
  showTime, 
  allowFuture = false 
}) => {
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const timeContainerRef = useRef(null);

  // Helper to emit a hybrid String object that acts as a string (.replace, .slice, etc.)
  // while simultaneously exposing .target.value for event-style listeners
  const triggerChange = (valStr) => {
    if (typeof onChange !== 'function') return;
    const s = String(valStr ?? '');
    const wrapper = new String(s);
    wrapper.target = { value: s };
    wrapper.currentTarget = { value: s };
    wrapper.value = s;
    onChange(wrapper);
  };

  // Safely extract string value if an event object or Date was passed
  let rawValue = value;
  if (rawValue && typeof rawValue === 'object') {
    if (rawValue.target && typeof rawValue.target.value !== 'undefined') {
      rawValue = rawValue.target.value;
    } else if (rawValue instanceof Date && !isNaN(rawValue)) {
      const year = rawValue.getFullYear();
      const month = String(rawValue.getMonth() + 1).padStart(2, '0');
      const day = String(rawValue.getDate()).padStart(2, '0');
      const hr = String(rawValue.getHours()).padStart(2, '0');
      const min = String(rawValue.getMinutes()).padStart(2, '0');
      rawValue = showTime ? `${year}-${month}-${day}T${hr}:${min}` : `${year}-${month}-${day}`;
    }
  }

  // Parse value
  let selectedDate = null;
  let timeString = '00:00';
  
  if (rawValue && typeof rawValue === 'string') {
    if (rawValue.includes('T')) {
      const [datePart, timePart] = rawValue.split('T');
      const [y, m, d] = datePart.split('-');
      const [hr, min] = timePart.split(':');
      if (y && m && d) {
        selectedDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      }
      if (hr && min) {
        timeString = `${hr.slice(0, 2)}:${min.slice(0, 2)}`;
      }
    } else {
      const [y, m, d] = rawValue.split('T')[0].split('-');
      if (y && m && d) {
        selectedDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      }
    }
  }

  // Determine max date: by default cannot pick future dates for reports
  let maxDate = null;
  let rawMax = max;
  if (rawMax && typeof rawMax === 'object' && rawMax.target && typeof rawMax.target.value !== 'undefined') {
    rawMax = rawMax.target.value;
  }
  if (rawMax && typeof rawMax === 'string') {
    const [y, m, d] = rawMax.split('T')[0].split('-');
    if (y && m && d) {
      maxDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    }
  } else if (!allowFuture) {
    maxDate = new Date();
  }

  // Check if selected date is today
  const isToday = useMemo(() => {
    if (!selectedDate) return false;
    const now = new Date();
    return (
      selectedDate.getFullYear() === now.getFullYear() &&
      selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getDate() === now.getDate()
    );
  }, [selectedDate]);

  // Current time components
  const currentNow = useMemo(() => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    return {
      h,
      m,
      str: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      label: formatDisplayTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    };
  }, []);

  // Clamp time if today and time is in the future
  useEffect(() => {
    if (isToday && showTime && selectedDate) {
      const parts = timeString.split(':');
      if (parts.length === 2) {
        const curH = parseInt(parts[0], 10);
        const curM = parseInt(parts[1], 10);
        if (curH > currentNow.h || (curH === currentNow.h && curM > currentNow.m)) {
          // Time is in future on today's date -> auto-clamp to current time
          const year = selectedDate.getFullYear();
          const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
          const day = String(selectedDate.getDate()).padStart(2, '0');
          triggerChange(`${year}-${month}-${day}T${currentNow.str}`);
        }
      }
    }
  }, [isToday, showTime, selectedDate, timeString, currentNow, onChange]);

  // Close time dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (timeContainerRef.current && !timeContainerRef.current.contains(e.target)) {
        setIsTimeDropdownOpen(false);
      }
    };
    if (isTimeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTimeDropdownOpen]);

  // Generate selectable time options (capped at current time if today)
  const timeOptions = useMemo(() => {
    const options = [];
    const maxH = isToday ? currentNow.h : 23;
    const maxM = isToday ? currentNow.m : 59;

    let exactNowAdded = false;

    for (let h = 0; h <= maxH; h++) {
      for (let m = 0; m < 60; m += 30) {
        if (isToday && (h > maxH || (h === maxH && m > maxM))) {
          continue; // Don't show future times for today!
        }
        
        // If current time falls between slots, include exact current time option
        if (isToday && !exactNowAdded && (h > currentNow.h || (h === currentNow.h && m > currentNow.m))) {
          options.push({
            value: currentNow.str,
            label: `${currentNow.label} (Now)`,
            isNow: true
          });
          exactNowAdded = true;
        }

        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        const val = `${hh}:${mm}`;
        options.push({
          value: val,
          label: formatDisplayTime(val),
          isNow: isToday && val === currentNow.str
        });
      }
    }

    // Ensure exact "now" is present if today and not cleanly on a 30m boundary
    if (isToday && !options.some(o => o.value === currentNow.str)) {
      options.push({
        value: currentNow.str,
        label: `${currentNow.label} (Now)`,
        isNow: true
      });
      // Sort options chronologically
      options.sort((a, b) => a.value.localeCompare(b.value));
    }

    return options;
  }, [isToday, currentNow]);

  const handleDateChange = (date) => {
    if (!date) {
      triggerChange('');
      return;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    if (showTime) {
      // If newly picked date is today, ensure time does not exceed current time
      let safeTime = timeString;
      const todayDate = new Date();
      if (
        date.getFullYear() === todayDate.getFullYear() &&
        date.getMonth() === todayDate.getMonth() &&
        date.getDate() === todayDate.getDate()
      ) {
        const parts = safeTime.split(':');
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (h > todayDate.getHours() || (h === todayDate.getHours() && m > todayDate.getMinutes())) {
          safeTime = `${String(todayDate.getHours()).padStart(2, '0')}:${String(todayDate.getMinutes()).padStart(2, '0')}`;
        }
      }
      triggerChange(`${year}-${month}-${day}T${safeTime}`);
    } else {
      triggerChange(`${year}-${month}-${day}`);
    }
  };

  const handleSelectTime = (newTime) => {
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      triggerChange(`${year}-${month}-${day}T${newTime}`);
    } else {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      triggerChange(`${year}-${month}-${day}T${newTime}`);
    }
    setIsTimeDropdownOpen(false);
  };

  const defaultStyle = {
    width: '100%', 
    padding: '7px 10px', 
    borderRadius: '6px', 
    border: '1px solid #CBD5E1', 
    outline: 'none', 
    boxSizing: 'border-box', 
    color: '#0F172A',
    fontSize: '13px',
    fontWeight: 500,
    background: '#FAFAFA',
    fontFamily: 'inherit',
    ...style
  };

  if (showTime) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: style?.width || 'auto' }}>
        {/* Date Input */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <DatePicker
            selected={selectedDate}
            onChange={handleDateChange}
            dateFormat="dd-MM-yyyy"
            maxDate={maxDate}
            portalId="root"
            customInput={<CustomDateInput />}
          />
        </div>

        {/* Custom Sleek Time Selector */}
        <div ref={timeContainerRef} style={{ position: 'relative', flex: '0 0 auto' }}>
          <button
            type="button"
            onClick={() => setIsTimeDropdownOpen(!isTimeDropdownOpen)}
            style={{
              ...defaultStyle,
              width: '118px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 10px',
              background: isTimeDropdownOpen ? '#F8FAFC' : '#FAFAFA',
              borderColor: isTimeDropdownOpen ? '#9333EA' : '#CBD5E1',
              boxShadow: isTimeDropdownOpen ? '0 0 0 2px rgba(147, 51, 234, 0.15)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Clock size={13} color="#9333EA" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>
                {formatDisplayTime(timeString)}
              </span>
            </div>
            <ChevronDown size={12} color="#64748B" style={{ transform: isTimeDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>

          {/* Floating Time Dropdown Popover */}
          {isTimeDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                width: '210px',
                background: '#FFFFFF',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                zIndex: 99999,
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              {/* Header with Today & Now pill */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px 6px', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {isToday ? 'Today (Max: Now)' : 'Select Time'}
                </span>
                {isToday && (
                  <button
                    type="button"
                    onClick={() => handleSelectTime(currentNow.str)}
                    style={{
                      background: '#F3E8FF',
                      color: '#9333EA',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                  >
                    <Zap size={10} /> Now
                  </button>
                )}
              </div>

              {/* Quick Preset Buttons */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleSelectTime('00:00')}
                  style={{
                    flex: 1,
                    padding: '4px 6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    background: timeString === '00:00' ? '#9333EA' : '#F8FAFC',
                    color: timeString === '00:00' ? '#FFF' : '#475569',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  00:00 AM
                </button>
                {(!isToday || currentNow.h >= 12) && (
                  <button
                    type="button"
                    onClick={() => handleSelectTime('12:00')}
                    style={{
                      flex: 1,
                      padding: '4px 6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: timeString === '12:00' ? '#9333EA' : '#F8FAFC',
                      color: timeString === '12:00' ? '#FFF' : '#475569',
                      border: '1px solid #E2E8F0',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    12:00 PM
                  </button>
                )}
                {!isToday && (
                  <button
                    type="button"
                    onClick={() => handleSelectTime('23:59')}
                    style={{
                      flex: 1,
                      padding: '4px 6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: timeString === '23:59' ? '#9333EA' : '#F8FAFC',
                      color: timeString === '23:59' ? '#FFF' : '#475569',
                      border: '1px solid #E2E8F0',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    11:59 PM
                  </button>
                )}
              </div>

              {/* Scrollable Time Slots List */}
              <div
                style={{
                  maxHeight: '190px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  paddingRight: '2px'
                }}
              >
                {timeOptions.map((opt) => {
                  const isSelected = opt.value === timeString;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelectTime(opt.value)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        background: isSelected ? 'linear-gradient(135deg, #a855f7, #9333ea)' : 'transparent',
                        color: isSelected ? '#FFFFFF' : '#1E293B',
                        fontSize: '12px',
                        fontWeight: isSelected ? 700 : 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.1s'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#F1F5F9';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check size={13} color="#FFFFFF" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <DatePicker
      selected={selectedDate}
      onChange={handleDateChange}
      dateFormat="dd-MM-yyyy"
      maxDate={maxDate}
      customInput={<CustomDateInput style={style} />}
    />
  );
};

export default CustomDatePicker;
