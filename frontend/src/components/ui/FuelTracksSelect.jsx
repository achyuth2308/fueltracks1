import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/**
 * FuelTracksSelect
 * Reusable dropdown component matching the FuelTracks Orange design system.
 * Eliminates native browser/OS blue highlight on select/option elements.
 * 
 * Props:
 * - value: string | number
 * - onChange: (value: any) => void
 * - options: Array<{ value: string|number, label: string }> | Array<string>
 * - placeholder?: string
 * - disabled?: boolean
 * - height?: string | number (default: '42px')
 * - style?: React.CSSProperties
 * - menuStyle?: React.CSSProperties
 */
export default function FuelTracksSelect({
  value,
  onChange,
  options = [],
  placeholder = '-- Select --',
  disabled = false,
  height = '42px',
  style = {},
  menuStyle = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Normalize options to { value, label }
  const normalizedOptions = options.map((opt) => {
    if (opt && typeof opt === 'object') {
      return { value: opt.value, label: opt.label !== undefined ? opt.label : opt.value };
    }
    return { value: opt, label: opt };
  });

  const selectedOption = normalizedOptions.find(
    (o) => String(o.value) === String(value) && (value !== '' || o.value === '')
  );

  const displayLabel = selectedOption ? selectedOption.label : placeholder;
  const hasValue = value !== undefined && value !== null && value !== '' && value !== 'all';

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        boxSizing: 'border-box',
        ...style
      }}
    >
      {/* Trigger Box */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        style={{
          width: '100%',
          height: typeof height === 'number' ? `${height}px` : height,
          minHeight: typeof height === 'number' ? `${height}px` : height,
          padding: '0 14px',
          borderRadius: '8px',
          border: isOpen ? '1.5px solid #f97316' : '1px solid #cbd5e1',
          background: disabled ? '#f8fafc' : '#ffffff',
          fontSize: '13.5px',
          fontWeight: hasValue ? 600 : 500,
          color: disabled ? '#94a3b8' : (hasValue ? '#0f172a' : '#64748b'),
          outline: 'none',
          boxSizing: 'border-box',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          boxShadow: isOpen ? '0 0 0 3px rgba(249, 115, 22, 0.18)' : 'none',
          transition: 'all 0.15s ease',
          userSelect: 'none'
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            textAlign: 'left'
          }}
        >
          {displayLabel}
        </span>
        <ChevronDown
          size={16}
          style={{
            color: isOpen ? '#f97316' : '#64748b',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0
          }}
        />
      </div>

      {/* Dropdown Menu - 100% Brand Orange Theme (No Browser Blue) */}
      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: '240px',
            overflowY: 'auto',
            background: '#ffffff',
            border: '1px solid #fed7aa',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(249, 115, 22, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
            zIndex: 9999,
            padding: '5px',
            boxSizing: 'border-box',
            ...menuStyle
          }}
        >
          {normalizedOptions.map((opt, idx) => {
            const isSelected = String(opt.value) === String(value);

            return (
              <div
                key={opt.value !== undefined ? String(opt.value) : idx}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={{
                  padding: '9px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? '#ffffff' : '#1e293b',
                  background: isSelected ? '#f97316' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  marginBottom: '2px',
                  transition: 'background 0.12s ease, color 0.12s ease',
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = '#fff7ed';
                    e.currentTarget.style.color = '#ea580c';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#1e293b';
                  }
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {opt.label}
                </span>
                {isSelected && <Check size={14} color="#ffffff" style={{ flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
