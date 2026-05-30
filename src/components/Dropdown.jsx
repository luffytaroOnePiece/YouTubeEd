import React, { useState, useRef, useEffect } from 'react';

export default function Dropdown({ id, value, options, onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption?.label || placeholder || 'Select...';

  return (
    <div className="dropdown" ref={ref} id={id}>
      <button
        className={`dropdown__trigger ${isOpen ? 'dropdown__trigger--open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span className="dropdown__label">{displayLabel}</span>
        <svg
          className={`dropdown__chevron ${isOpen ? 'dropdown__chevron--open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="dropdown__menu">
          {options.map((opt) => (
            <button
              key={opt.value}
              className={`dropdown__item ${opt.value === value ? 'dropdown__item--active' : ''}`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              type="button"
            >
              <span className="dropdown__item-label">{opt.label}</span>
              {opt.count !== undefined && (
                <span className="dropdown__item-count">{opt.count}</span>
              )}
              {opt.value === value && (
                <svg className="dropdown__check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
