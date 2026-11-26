import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, X } from 'lucide-react';

const SearchableSelect = ({
  options = [],
  value = '',
  onChange = () => {},
  placeholder = '-- Select --',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No matching results',
  disabled = false,
  className = '',
  style = {},
  triggerStyle = {},
  usePortal = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);
  const [portalPosition, setPortalPosition] = useState({ top: null, bottom: null, left: 0, width: 0 });

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const inContainer = containerRef.current && containerRef.current.contains(event.target);
      const inMenu = menuRef.current && menuRef.current.contains(event.target);
      if (!inContainer && !inMenu) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update portal position
  useEffect(() => {
    if (isOpen && usePortal && containerRef.current) {
      const updatePosition = () => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        // Only open upward if space below is too small (< 150px) and there's more space above
        const openUpward = spaceBelow < 150 && rect.top > spaceBelow;

        const width = Math.max(rect.width, 195);
        let left = rect.left;
        // Prevent overflowing the right edge of viewport
        if (left + width > window.innerWidth - 10) {
          left = Math.max(10, window.innerWidth - width - 10);
        }

        setPortalPosition({
          top: openUpward ? null : rect.bottom + 4,
          bottom: openUpward ? (window.innerHeight - rect.top) + 4 : null,
          left,
          width
        });
      };

      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, usePortal]);

  // Auto focus search input on open
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    }
  }, [isOpen]);

  // Find currently selected item
  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  // Filter options based on search query
  const filteredOptions = options.filter((opt) => {
    if (!searchTerm.trim()) return true;
    const query = searchTerm.toLowerCase();
    const labelMatch = opt.label && String(opt.label).toLowerCase().includes(query);
    const sublabelMatch = opt.sublabel && String(opt.sublabel).toLowerCase().includes(query);
    return labelMatch || sublabelMatch;
  });

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      style={{ boxSizing: 'border-box', ...style }}
    >
      {/* Dropdown trigger */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: '8px',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: isOpen ? '#f97316' : '#CBD5E1',
          fontSize: '14px',
          outline: 'none',
          background: disabled ? '#F8FAFC' : '#FFFFFF',
          color: selectedOption ? '#475569' : '#94A3B8',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          boxSizing: 'border-box',
          boxShadow: isOpen ? '0 0 0 2px rgba(249, 115, 22, 0.15)' : 'none',
          transition: 'all 0.15s ease',
          ...triggerStyle
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: selectedOption ? 500 : 400
          }}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <ChevronDown
            size={16}
            style={{
              color: '#64748B',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }}
          />
        </div>
      </div>

      {/* Dropdown menu */}
      {isOpen && (() => {
        const menuContent = (
          <div
            ref={menuRef}
            style={{
              position: usePortal ? 'fixed' : 'absolute',
              top: usePortal ? (portalPosition.top !== null ? `${portalPosition.top}px` : undefined) : 'calc(100% + 4px)',
              bottom: usePortal ? (portalPosition.bottom !== null ? `${portalPosition.bottom}px` : undefined) : undefined,
              left: usePortal ? `${portalPosition.left}px` : 0,
              right: usePortal ? undefined : 0,
              width: usePortal ? `${portalPosition.width}px` : undefined,
              minWidth: '195px',
              zIndex: 99999,
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}
          >
            {/* Search bar inside dropdown */}
            <div
              style={{
                padding: '5px',
                borderBottom: '1px solid #F1F5F9',
                background: '#F8FAFC'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 7px',
                  background: '#FFFFFF',
                  borderRadius: '5px',
                  border: '1px solid #CBD5E1'
                }}
              >
                <Search size={12} color="#94A3B8" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    border: 'none',
                    outline: 'none',
                    fontSize: '11.5px',
                    width: '100%',
                    color: '#111827',
                    background: 'transparent'
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: '#94A3B8'
                    }}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* Options list */}
            <div
              style={{
                maxHeight: '130px',
                overflowY: 'auto'
              }}
            >
              {/* Default / Clear option */}
              <div
                onClick={() => handleSelect('')}
                style={{
                  padding: '5px 10px',
                  fontSize: '11.5px',
                  color: '#64748B',
                  cursor: 'pointer',
                  borderBottom: '1px dashed #F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'background 0.1s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span>{placeholder}</span>
                {!value && <Check size={12} color="#f97316" />}
              </div>

              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => {
                  const isSelected = String(opt.value) === String(value);
                  return (
                    <div
                      key={opt.value}
                      onClick={() => handleSelect(opt.value)}
                      style={{
                        padding: '5px 10px',
                        fontSize: '11.5px',
                        color: isSelected ? '#EA580C' : '#475569',
                        background: isSelected ? '#FFF7ED' : 'transparent',
                        fontWeight: isSelected ? 600 : 400,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        transition: 'background 0.1s'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#FFF7ED';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {opt.label}
                        </span>
                        {opt.sublabel && (
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                            {opt.sublabel}
                          </span>
                        )}
                      </div>
                      {isSelected && <Check size={14} color="#f97316" style={{ flexShrink: 0 }} />}
                    </div>
                  );
                })
              ) : (
                <div
                  style={{
                    padding: '16px',
                    textAlign: 'center',
                    fontSize: '13px',
                    color: '#94A3B8'
                  }}
                >
                  {emptyMessage}
                </div>
              )}
            </div>
          </div>
        );

        return usePortal ? createPortal(menuContent, document.body) : menuContent;
      })()}
    </div>
  );
};

export default SearchableSelect;
