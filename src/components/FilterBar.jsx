import React from 'react';
import Dropdown from './Dropdown';


export default function FilterBar({
  groups,
  groupMeta,
  activeGroup,
  onGroupChange,
  categories,
  activeCategory,
  onCategoryChange,
  playlists,
  activePlaylist,
  onPlaylistChange,
  availableResolutions,
  activeResolution,
  onResolutionChange,
  activeSort,
  onSortChange,
  searchQuery,
  onSearchChange,
  videoCounts,
  gridColumns,
  onGridColumnsChange,
  hasActiveFilters,
  onReset,
  shuffleActive,
  onToggleShuffle,
  onQuickAccess,
  isLocal,
  isFavoritesMode,
  onToggleFavoritesMode,
}) {
  // Build group options
  const groupOptions = [
    { value: 'All', label: `All Groups`, count: videoCounts.total },
    ...groups.map((g) => ({
      value: g,
      label: `${groupMeta[g]?.icon || ''} ${g}`,
      count: videoCounts.groups[g] || 0,
    })),
  ];

  // Build category options
  const categoryOptions = [
    { value: 'All', label: 'All Categories' },
    ...categories.map((c) => ({
      value: c,
      label: c,
      count: videoCounts.categories[`${activeGroup}::${c}`] || 0,
    })),
  ];

  // Build resolution options
  const resolutionOptions = [
    { value: 'All', label: 'All Quality' },
    ...availableResolutions.map((r) => ({ value: r, label: r })),
  ];

  const isTeluguActive = activeGroup === 'Music' && activeCategory === 'Telugu';
  const isHindiActive = activeGroup === 'Music' && activeCategory === 'Hindi';
  const is8KActive = activeResolution === '8K' && activeGroup === 'All';

  // Build sort options
  const sortOptions = [
    { value: 'Newest First', label: 'Newest' },
    { value: 'Oldest First', label: 'Oldest' },
    { value: 'Highest Rated', label: 'Highest Rated' },
    { value: 'Lowest Rated', label: 'Lowest Rated' }
  ];


  return (
    <div className="filter-bar">
      <div className="filter-bar__top">

        {/* Dropdowns */}
        <div className="filter-bar__dropdowns">
          <Dropdown
            id="group-select"
            value={activeGroup}
            options={groupOptions}
            onChange={onGroupChange}
            placeholder="All Groups"
          />

          {activeGroup !== 'All' && categories.length > 0 && (
            <Dropdown
              id="category-select"
              value={activeCategory}
              options={categoryOptions}
              onChange={onCategoryChange}
              placeholder="All Categories"
            />
          )}

          {availableResolutions.length > 0 && (
            <Dropdown
              id="resolution-select"
              value={activeResolution}
              options={resolutionOptions}
              onChange={onResolutionChange}
              placeholder="All Quality"
            />
          )}

          {activeGroup !== 'All' && (
            <Dropdown
              id="sort-select"
              value={activeSort}
              options={sortOptions}
              onChange={onSortChange}
              placeholder="Sort by"
            />
          )}
        </div>

        {/* Shuffle button */}
        <button
          className={`filter-bar__reset ${shuffleActive ? 'filter-bar__reset--active' : ''}`}
          onClick={onToggleShuffle}
          title="Shuffle Videos"
          style={shuffleActive ? { color: '#ff2d55', borderColor: '#ff2d55', background: 'rgba(255, 45, 85, 0.1)' } : {}}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 3 21 3 21 8"></polyline>
            <line x1="4" y1="20" x2="21" y2="3"></line>
            <polyline points="21 16 21 21 16 21"></polyline>
            <line x1="15" y1="15" x2="21" y2="21"></line>
            <line x1="4" y1="4" x2="9" y2="9"></line>
          </svg>
          Shuffle
        </button>

        {/* Favorites Mode button */}
        <button
          className={`filter-bar__reset ${isFavoritesMode ? 'filter-bar__reset--active' : ''}`}
          onClick={onToggleFavoritesMode}
          title="Favorites"
          style={isFavoritesMode ? { color: '#ff2d55', borderColor: '#ff2d55', background: 'rgba(255, 45, 85, 0.1)' } : {}}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
          Favorites
        </button>

        {/* Reset button */}
        {hasActiveFilters && (
          <button
            className="filter-bar__reset"
            onClick={onReset}
            title="Reset all filters"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            Reset
          </button>
        )}

        {/* Quick Access — right side */}
        <div className="filter-bar__quick-group">
          <div className="filter-bar__divider" />
          <span className="filter-bar__quick-label">Quick Access</span>
          <button
            className={`filter-bar__quick-chip ${isTeluguActive ? 'filter-bar__quick-chip--active' : ''}`}
            onClick={() => isTeluguActive ? onReset() : onQuickAccess('Music', 'Telugu', 'All')}
          >
            Telugu
          </button>
          <button
            className={`filter-bar__quick-chip ${isHindiActive ? 'filter-bar__quick-chip--active' : ''}`}
            onClick={() => isHindiActive ? onReset() : onQuickAccess('Music', 'Hindi', 'All')}
          >
            Hindi
          </button>
          <button
            className={`filter-bar__quick-chip ${is8KActive ? 'filter-bar__quick-chip--active' : ''}`}
            onClick={() => is8KActive ? onReset() : onQuickAccess('All', 'All', '8K')}
          >
            8K Ultra
          </button>

        </div>
      </div>

      {/* Row 2: Playlist Tabs */}
      {activeGroup !== 'All' && activeCategory !== 'All' && playlists.length > 0 && (
        <div className="filter-bar__tabs">
          <button
            className={`filter-bar__tab ${activePlaylist === 'All' ? 'filter-bar__tab--active' : ''}`}
            onClick={() => onPlaylistChange('All')}
          >
            All
          </button>
          {playlists.map((pl) => {
            const count = videoCounts.playlists[`${activeGroup}::${activeCategory}::${pl}`] || 0;
            return (
              <button
                key={pl}
                className={`filter-bar__tab ${activePlaylist === pl ? 'filter-bar__tab--active' : ''}`}
                onClick={() => onPlaylistChange(pl)}
              >
                {pl}
                {/* <span className="filter-bar__count">{count}</span> */}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

