import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

const ComboboxInput = ({
  label,
  value = '',
  onChange = () => {},
  options = [],
  placeholder = '-- Select or type custom --',
  style = {},
  labelStyle = {},
  inputStyle = {},
  disabled = false,
  focused = false,
  onFocus,
  onBlur
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        if (onBlur) onBlur();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onBlur]);

  const normalizedOptions = options.map(opt =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const query = String(value || '').toLowerCase().trim();
  const filteredOptions = normalizedOptions.filter(opt => {
    if (!query) return true;
    const lMatch = opt.label && String(opt.label).toLowerCase().includes(query);
    const vMatch = opt.value && String(opt.value).toLowerCase().includes(query);
    const sMatch = opt.sublabel && String(opt.sublabel).toLowerCase().includes(query);
    return lMatch || vMatch || sMatch;
  });

  const handleSelect = (optVal) => {
    onChange(optVal);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      {label && (
        <label style={{ fontSize: '11px', fontWeight: 600, color: '#111827', marginBottom: '3px', display: 'block', ...labelStyle }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
            if (onFocus) onFocus();
          }}
          style={{
            width: '100%',
            height: '36px',
            padding: '5px 50px 5px 10px',
            borderRadius: '6px',
            border: isOpen || focused ? '1.5px solid #f97316' : '1px solid #CBD5E1',
            fontSize: '12.5px',
            color: '#0F172A',
            fontWeight: 500,
            background: disabled ? '#F8FAFC' : '#FFFFFF',
            outline: 'none',
            boxSizing: 'border-box',
            boxShadow: isOpen || focused ? '0 0 0 2px rgba(249, 115, 22, 0.15)' : 'none',
            transition: 'all 0.15s ease',
            ...inputStyle
          }}
        />

        {/* Clear & Dropdown toggle buttons */}
        <div style={{ position: 'absolute', right: '6px', display: 'flex', alignItems: 'center', gap: '2px' }}>
          {value && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClear}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px',
                cursor: 'pointer',
                color: '#94A3B8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px'
              }}
              title="Clear"
            >
              <X size={13} />
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            onClick={() => !disabled && setIsOpen(prev => !prev)}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px'
            }}
            title="Toggle suggestions dropdown"
          >
            <ChevronDown
              size={14}
              style={{
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}
            />
          </button>
        </div>
      </div>

      {/* Suggestions Dropdown Menu */}
      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: '210px',
            overflowY: 'auto',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            zIndex: 999999
          }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, i) => {
              const optVal = opt.value || opt.label;
              const isSelected = String(value).toLowerCase().trim() === String(optVal).toLowerCase().trim();
              return (
                <div
                  key={opt.value || i}
                  onMouseDown={(e) => {
                    // Use onMouseDown so it fires before input onBlur
                    e.preventDefault();
                    handleSelect(optVal);
                  }}
                  style={{
                    padding: '8px 12px',
                    fontSize: '12.5px',
                    color: isSelected ? '#EA580C' : '#1E293B',
                    cursor: 'pointer',
                    borderBottom: i < filteredOptions.length - 1 ? '1px solid #F1F5F9' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    background: isSelected ? '#FFF7ED' : 'transparent',
                    transition: 'background 0.1s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = isSelected ? '#FFF7ED' : 'transparent';
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{opt.label || opt.value}</span>
                  {opt.sublabel && (
                    <span style={{ fontSize: '11px', color: '#64748B' }}>{opt.sublabel}</span>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ padding: '10px 12px', fontSize: '11.5px', color: '#64748B', fontStyle: 'italic' }}>
              No predefined users found. You can keep typing custom name "{value}".
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ComboboxInput;
