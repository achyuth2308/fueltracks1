import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Convert YYYY-MM-DD -> DD-MM-YYYY
export const toDisplayDate = (isoDate) => {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return isoDate;
  }
  return isoDate;
};

// Convert DD-MM-YYYY -> YYYY-MM-DD
export const toIsoDate = (displayDate) => {
  if (!displayDate) return '';
  const parts = displayDate.split('-');
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return displayDate;
  }
  return displayDate;
};

const TelematicsDatePicker = ({ value, onChange, placeholder = 'DD-MM-YYYY' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse current value
  const parsedDate = React.useMemo(() => {
    if (!value) return new Date();
    const iso = value.includes('-') && value.split('-')[0].length === 4 ? value : toIsoDate(value);
    const [y, m, d] = iso.split('-');
    if (y && m && d) {
      return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    }
    return new Date();
  }, [value]);

  const [viewYear, setViewYear] = useState(parsedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsedDate.getMonth());

  useEffect(() => {
    setViewYear(parsedDate.getFullYear());
    setViewMonth(parsedDate.getMonth());
  }, [parsedDate]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (day, isCurrentMonth, e) => {
    e.stopPropagation();
    let y = viewYear;
    let m = viewMonth;
    if (!isCurrentMonth) {
      if (day > 15) {
        // Prev month
        if (m === 0) { m = 11; y -= 1; } else { m -= 1; }
      } else {
        // Next month
        if (m === 11) { m = 0; y += 1; } else { m += 1; }
      }
    }
    const isoStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(isoStr);
    setIsOpen(false);
  };

  // Generate 6x7 grid of days for viewYear & viewMonth
  const calendarDays = React.useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days = [];
    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, isCurrent: false });
    }
    // Current month
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      days.push({ day: i, isCurrent: true });
    }
    // Next month padding to fill complete grid (multiples of 7)
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        days.push({ day: i, isCurrent: false });
      }
    }
    return days;
  }, [viewYear, viewMonth]);

  const displayVal = toDisplayDate(value);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <input
        type="text"
        readOnly
        value={displayVal}
        placeholder={placeholder}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '130px',
          padding: '6px 12px',
          borderRadius: '4px',
          border: '1px solid #CBD5E1',
          background: '#FFFFFF',
          color: '#0F172A',
          fontSize: '13px',
          fontWeight: 500,
          textAlign: 'center',
          cursor: 'pointer',
          outline: 'none',
          boxSizing: 'border-box'
        }}
      />

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          zIndex: 9999,
          background: '#FFFFFF',
          borderRadius: '6px',
          border: '1px solid #CBD5E1',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          padding: '12px',
          width: '240px',
          userSelect: 'none'
        }}>
          {/* Month / Year Navigation */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px'
          }}>
            <button
              type="button"
              onClick={handlePrevMonth}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                color: '#64748B',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>
              {MONTHS[viewMonth]} {viewYear}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                color: '#64748B',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekday Names */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            textAlign: 'center',
            fontSize: '11px',
            fontWeight: 700,
            color: '#64748B',
            marginBottom: '6px'
          }}>
            {WEEKDAYS.map(w => (
              <div key={w}>{w}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '2px',
            textAlign: 'center',
            fontSize: '12px'
          }}>
            {calendarDays.map((item, idx) => {
              const isSelected =
                item.isCurrent &&
                parsedDate.getDate() === item.day &&
                parsedDate.getMonth() === viewMonth &&
                parsedDate.getFullYear() === viewYear;

              return (
                <div
                  key={idx}
                  onClick={(e) => handleSelectDay(item.day, item.isCurrent, e)}
                  style={{
                    padding: '6px 0',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    fontWeight: isSelected ? 700 : (item.isCurrent ? 500 : 400),
                    background: isSelected ? '#0284C7' : 'transparent',
                    color: isSelected ? '#FFFFFF' : (item.isCurrent ? '#1E293B' : '#94A3B8')
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = '#F1F5F9';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {item.day}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TelematicsDatePicker;
