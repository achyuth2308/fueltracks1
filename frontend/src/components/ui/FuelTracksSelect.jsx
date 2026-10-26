import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

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
 * - searchable?: boolean | 'auto'
 * - searchPlaceholder?: string
 * - emptyMessage?: string
 */
export default function FuelTracksSelect({
  value,
  onChange,
  options = [],
  placeholder = '-- Select --',
  disabled = false,
  height = '42px',
  style = {},
  menuStyle = {},
  searchable = false,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No options found'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  const isSearchable = searchable === true || (searchable === 'auto' && options.length >= 8);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && isSearchable) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearchTerm('');
    }
  }, [isOpen, isSearchable]);

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
      return { value: opt.value, label: opt.label !== undefined ? String(opt.label) : String(opt.value) };
    }
    return { value: opt, label: String(opt) };
  });

  const selectedOption = normalizedOptions.find(
    (o) => String(o.value) === String(value) && (value !== '' || o.value === '')
  );

  const displayLabel = selectedOption ? selectedOption.label : placeholder;
  const hasValue = value !== undefined && value !== null && value !== '' && value !== 'all';

  const filteredOptions = isSearchable && searchTerm.trim()
    ? normalizedOptions.filter((opt) =>
        (opt.label || '').toLowerCase().includes(searchTerm.toLowerCase().trim())
      )
    : normalizedOptions;

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
            minWidth: isSearchable ? '210px' : '100%',
            maxHeight: '280px',
            background: '#ffffff',
            border: '1px solid #fed7aa',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(249, 115, 22, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxSizing: 'border-box',
            ...menuStyle
          }}
        >
          {/* Sticky Search Header */}
          {isSearchable && (
            <div
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                padding: '6px 6px 5px 6px',
                borderBottom: '1px solid #f1f5f9',
                background: '#ffffff',
                flexShrink: 0
              }}
            >
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search
                  size={13}
                  color="#94a3b8"
                  style={{
                    position: 'absolute',
                    left: '8px',
                    pointerEvents: 'none'
                  }}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  style={{
                    width: '100%',
                    height: '30px',
                    padding: '4px 26px 4px 26px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#0f172a',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#f97316';
                    e.target.style.background = '#ffffff';
                    e.target.style.boxShadow = '0 0 0 2px rgba(249, 115, 22, 0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.background = '#f8fafc';
                    e.target.style.boxShadow = 'none';
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Escape') {
                      setIsOpen(false);
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (filteredOptions.length > 0) {
                        onChange(filteredOptions[0].value);
                        setIsOpen(false);
                      }
                    }
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchTerm('');
                      searchInputRef.current?.focus();
                    }}
                    style={{
                      position: 'absolute',
                      right: '6px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      color: '#94a3b8'
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options Scrollable List */}
          <div
            style={{
              overflowY: 'auto',
              maxHeight: '220px',
              padding: '4px',
              flex: 1
            }}
          >
            {filteredOptions.length === 0 ? (
              <div
                style={{
                  padding: '12px 8px',
                  fontSize: '12px',
                  color: '#94a3b8',
                  textAlign: 'center',
                  fontStyle: 'italic'
                }}
              >
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);

                return (
                  <div
                    key={opt.value !== undefined ? String(opt.value) : idx}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    style={{
                      padding: '8px 12px',
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
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
