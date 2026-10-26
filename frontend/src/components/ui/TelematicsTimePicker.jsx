import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

// Format 24h "HH:mm" to 12h "hh:mm A"
export const to12Hour = (time24) => {
  if (!time24) return '12:00 AM';
  if (time24.includes('AM') || time24.includes('PM')) return time24;
  const [hrStr, minStr] = time24.split(':');
  const h = parseInt(hrStr, 10);
  const m = minStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : (h > 12 ? h - 12 : h);
  return `${String(displayH).padStart(2, '0')}:${m} ${ampm}`;
};

// Format 12h "hh:mm A" to 24h "HH:mm"
export const to24Hour = (time12) => {
  if (!time12) return '00:00';
  if (!time12.includes('AM') && !time12.includes('PM')) return time12;
  const parts = time12.trim().split(' ');
  const [hrStr, minStr] = parts[0].split(':');
  const ampm = (parts[1] || 'AM').toUpperCase();
  let h = parseInt(hrStr, 10);
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${minStr || '00'}`;
};

const TelematicsTimePicker = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse time components
  const displayValue = to12Hour(value);
  const [timePart, ampmPart] = displayValue.split(' ');
  const [hStr, mStr] = (timePart || '12:00').split(':');

  const currentH = parseInt(hStr, 10) || 12;
  const currentM = parseInt(mStr, 10) || 0;
  const currentAmPm = (ampmPart || 'AM').toUpperCase();

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

  const emitChange = (newH, newM, newAmPm) => {
    const h12 = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')} ${newAmPm}`;
    const h24 = to24Hour(h12);
    if (onChange) {
      onChange(h24, h12);
    }
  };

  const incrementHour = (e) => {
    e.stopPropagation();
    const nextH = currentH >= 12 ? 1 : currentH + 1;
    emitChange(nextH, currentM, currentAmPm);
  };

  const decrementHour = (e) => {
    e.stopPropagation();
    const nextH = currentH <= 1 ? 12 : currentH - 1;
    emitChange(nextH, currentM, currentAmPm);
  };

  const incrementMin = (e) => {
    e.stopPropagation();
    const nextM = currentM >= 59 ? 0 : currentM + 1;
    emitChange(currentH, nextM, currentAmPm);
  };

  const decrementMin = (e) => {
    e.stopPropagation();
    const nextM = currentM <= 0 ? 59 : currentM - 1;
    emitChange(currentH, nextM, currentAmPm);
  };

  const toggleAmPm = (e) => {
    e.stopPropagation();
    const nextAmPm = currentAmPm === 'AM' ? 'PM' : 'AM';
    emitChange(currentH, currentM, nextAmPm);
  };

  const selectPreset = (preset12, e) => {
    e.stopPropagation();
    const h24 = to24Hour(preset12);
    if (onChange) onChange(h24, preset12);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <input
        type="text"
        readOnly
        value={displayValue}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '110px',
          padding: '6px 10px',
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
          padding: '12px 16px',
          width: '190px',
          userSelect: 'none'
        }}>
          {/* Top Presets: 12:00 AM | 11:59 PM */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '10px',
            borderBottom: '1px solid #F1F5F9',
            marginBottom: '10px'
          }}>
            <button
              type="button"
              onClick={(e) => selectPreset('12:00 AM', e)}
              style={{
                background: 'none',
                border: 'none',
                color: '#0284C7',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: '3px'
              }}
            >
              12:00 AM
            </button>
            <button
              type="button"
              onClick={(e) => selectPreset('11:59 PM', e)}
              style={{
                background: 'none',
                border: 'none',
                color: '#0284C7',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: '3px'
              }}
            >
              11:59 PM
            </button>
          </div>

          {/* Time Spinners & AM/PM Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px'
          }}>
            {/* Hours Column */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button
                type="button"
                onClick={incrementHour}
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  padding: '3px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#334155'
                }}
              >
                <ChevronUp size={16} />
              </button>
              <div style={{
                fontSize: '15px',
                fontWeight: 700,
                color: '#0F172A',
                padding: '6px 0',
                width: '28px',
                textAlign: 'center'
              }}>
                {String(currentH).padStart(2, '0')}
              </div>
              <button
                type="button"
                onClick={decrementHour}
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  padding: '3px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#334155'
                }}
              >
                <ChevronDown size={16} />
              </button>
            </div>

            {/* Minutes Column */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button
                type="button"
                onClick={incrementMin}
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  padding: '3px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#334155'
                }}
              >
                <ChevronUp size={16} />
              </button>
              <div style={{
                fontSize: '15px',
                fontWeight: 700,
                color: '#0F172A',
                padding: '6px 0',
                width: '28px',
                textAlign: 'center'
              }}>
                {String(currentM).padStart(2, '0')}
              </div>
              <button
                type="button"
                onClick={decrementMin}
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  padding: '3px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#334155'
                }}
              >
                <ChevronDown size={16} />
              </button>
            </div>

            {/* AM / PM Toggle Pill */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button
                type="button"
                onClick={toggleAmPm}
                style={{
                  background: '#0284C7',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '12px',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(2, 132, 199, 0.2)'
                }}
              >
                {currentAmPm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TelematicsTimePicker;
