import React, { useState, useMemo, useEffect, useRef } from 'react';

const toCamelCase = (str) => str.replace(/\b\w/g, c => c.toUpperCase());

const AdvancedSearchPanel = ({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  availableResolutions,
  allVideos,
  tags,
  activeTag,
  onTagChange,
  availableRatings,
}) => {
  const panelRef = useRef(null);
  const [tagSearch, setTagSearch] = useState('');

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const availableTypes = useMemo(() => {
    const typeSet = new Set();
    allVideos.forEach(v => {
      if (v.type) typeSet.add(v.type);
    });
    return Array.from(typeSet).sort();
  }, [allVideos]);

  const availableYears = useMemo(() => {
    const yearSet = new Set();
    allVideos.forEach(v => {
      if (v.date) {
        const year = new Date(v.date).getFullYear();
        if (!isNaN(year)) yearSet.add(year);
      }
    });
    return Array.from(yearSet).sort((a,b) => b - a);
  }, [allVideos]);

  // Build tag names from tags data
  const tagNames = useMemo(() => {
    return tags ? Object.keys(tags).sort() : [];
  }, [tags]);

  if (!isOpen) return null;

  const toggleFilter = (prefix, value) => {
    const filterStr = `${prefix}:${value}`;
    // RegExp to find the specific prefix with any value
    const regex = new RegExp(`${prefix}:\\S+`, 'g');
    
    let newQuery = searchQuery;
    if (newQuery.match(regex)) {
      if (isActive(prefix, value)) {
        // Toggle off the exact match
        newQuery = newQuery.replace(new RegExp(`${prefix}:${value}(?:\\s|$)`, 'g'), ' ').trim();
      } else {
        // Replace existing prefix with new value
        newQuery = newQuery.replace(regex, filterStr).trim();
      }
    } else {
      // Add new
      newQuery = (newQuery + ' ' + filterStr).trim();
    }
    
    // Normalize spaces
    newQuery = newQuery.replace(/\s+/g, ' ');
    onSearchChange(newQuery);
  };

  const isActive = (prefix, value) => {
    const regex = new RegExp(`${prefix}:${value}(?:\\s|$)`);
    return regex.test(searchQuery);
  };

  return (
    <>
      <div className="adv-search-overlay" onClick={onClose} />
      <div className="adv-search-panel" ref={panelRef}>
        <div className="adv-search-panel__header">
          <h2 className="adv-search-panel__title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            Advanced Filters
          </h2>
          <button className="adv-search-panel__close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="adv-search-panel__content">
          <p className="adv-search-panel__desc">
            Use these tags to instantly refine your search results. They will be added to your search query.
          </p>

          {/* Tags section */}
          {tagNames.length > 0 && (
            <div className="adv-search-panel__group">
              <div className="adv-search-panel__group-title">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5, verticalAlign: '-2px' }}>
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                  <line x1="7" y1="7" x2="7.01" y2="7"></line>
                </svg>
                Tags
                <span className="adv-search-panel__group-count">{tagNames.length}</span>
              </div>
              <div className="adv-search-panel__tag-search">
                <svg className="adv-search-panel__tag-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  className="adv-search-panel__tag-search-input"
                  type="text"
                  placeholder="Search tags..."
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                />
                {tagSearch && (
                  <button className="adv-search-panel__tag-search-clear" onClick={() => setTagSearch('')}>✕</button>
                )}
              </div>
              <div className="adv-search-panel__chips">
                {tagNames
                  .filter(t => t.includes(tagSearch.toLowerCase().trim()))
                  .map(tagName => (
                  <button
                    key={tagName}
                    className={`adv-search-panel__chip ${activeTag === tagName ? 'adv-search-panel__chip--active' : ''}`}
                    onClick={() => onTagChange(activeTag === tagName ? null : tagName)}
                  >
                    {toCamelCase(tagName)}
                    <span className="adv-search-panel__tag-count">{tags[tagName]?.length || 0}</span>
                  </button>
                ))}
                {tagNames.filter(t => t.includes(tagSearch.toLowerCase().trim())).length === 0 && (
                  <span className="adv-search-panel__tag-empty">No tags match "{tagSearch}"</span>
                )}
              </div>
            </div>
          )}

          {availableResolutions && availableResolutions.length > 0 && (
            <div className="adv-search-panel__group">
              <div className="adv-search-panel__group-title">Resolution (res:)</div>
              <div className="adv-search-panel__chips">
                {availableResolutions.map(res => (
                  <button
                    key={res}
                    className={`adv-search-panel__chip ${isActive('res', res) ? 'adv-search-panel__chip--active' : ''}`}
                    onClick={() => toggleFilter('res', res)}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>
          )}

          {availableTypes && availableTypes.length > 0 && (
            <div className="adv-search-panel__group">
              <div className="adv-search-panel__group-title">Type (type:)</div>
              <div className="adv-search-panel__chips">
                {availableTypes.map(type => (
                  <button
                    key={type}
                    className={`adv-search-panel__chip ${isActive('type', type) ? 'adv-search-panel__chip--active' : ''}`}
                    onClick={() => toggleFilter('type', type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          {availableRatings && availableRatings.length > 0 && (
            <div className="adv-search-panel__group">
              <div className="adv-search-panel__group-title">Rating (rating:)</div>
              <div className="adv-search-panel__chips">
                {availableRatings.map(rating => (
                  <button
                    key={rating}
                    className={`adv-search-panel__chip ${isActive('rating', rating) ? 'adv-search-panel__chip--active' : ''}`}
                    onClick={() => toggleFilter('rating', rating)}
                  >
                    ★ {rating}
                  </button>
                ))}
              </div>
            </div>
          )}

          {availableYears && availableYears.length > 0 && (
            <div className="adv-search-panel__group">
              <div className="adv-search-panel__group-title">Release Year (after:)</div>
              <div className="adv-search-panel__chips">
                {availableYears.map(year => (
                  <button
                    key={year}
                    className={`adv-search-panel__chip ${isActive('after', year) ? 'adv-search-panel__chip--active' : ''}`}
                    onClick={() => toggleFilter('after', year)}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AdvancedSearchPanel;

