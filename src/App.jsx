import React, { useState, useMemo, useCallback, useEffect } from 'react';
import FilterBar from './components/FilterBar';
import VideoGrid from './components/VideoGrid';
import Player from './components/Player';
import ScriptsPage from './components/ScriptsPage';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import AdvancedSearchPanel from './components/AdvancedSearchPanel';
import { useUrlFilters } from './hooks/useUrlFilters';
import videosData from './data/videos.json';
import favData from './data/fav.json';
import tagsData from './data/tags.json';
import ratingsData from './data/ratings.json';
import './styles/App.css';

const INITIAL_FILTERS = {
  group: 'All',
  category: 'All',
  playlist: 'All',
  resolution: 'All',
  search: '',
  sort: 'Newest First'
};

// Seeded PRNG for stable shuffling
function pseudoRandom(seed) {
  let value = seed;
  return function() {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function App() {
  const [filters, setFilters] = useUrlFilters(INITIAL_FILTERS);
  const { group: activeGroup, category: activeCategory, playlist: activePlaylist, resolution: activeResolution, search: searchQuery, sort: activeSort } = filters;

  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const [favorites, setFavorites] = useState(Array.isArray(favData) ? favData : []);
  const [isFavoritesMode, setIsFavoritesMode] = useState(false);

  // Tags state
  const [tags, setTags] = useState(tagsData && typeof tagsData === 'object' && !Array.isArray(tagsData) ? tagsData : {});
  const [activeTag, setActiveTag] = useState(null);

  // Ratings state
  const [ratings, setRatings] = useState(ratingsData && typeof ratingsData === 'object' && !Array.isArray(ratingsData) ? ratingsData : {});


  const handleToggleFav = useCallback((video) => {
    if (!isLocal) return;
    const videoId = video.youtubeLinkID;
    
    // Optimistic update
    setFavorites(prev => 
      prev.includes(videoId) ? prev.filter(id => id !== videoId) : [...prev, videoId]
    );

    fetch('http://localhost:3001/api/fav', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId }),
    })
      .then(res => res.json())
      .then(data => setFavorites(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [isLocal]);

  // Tag handlers
  const handleToggleTag = useCallback((tag, videoId) => {
    if (!isLocal) return;
    const tagKey = tag.trim().toLowerCase();
    if (!tagKey) return;

    // Optimistic update
    setTags(prev => {
      const updated = { ...prev };
      if (!updated[tagKey]) updated[tagKey] = [];
      if (videoId) {
        if (updated[tagKey].includes(videoId)) {
          updated[tagKey] = updated[tagKey].filter(id => id !== videoId);
        } else {
          updated[tagKey] = [...updated[tagKey], videoId];
        }
      }
      return updated;
    });

    fetch('http://localhost:3001/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: tagKey, videoId }),
    })
      .then(res => res.json())
      .then(data => { if (data && typeof data === 'object' && !data.error) setTags(data); })
      .catch(console.error);
  }, [isLocal]);

  // Rating handler
  const handleSetRating = useCallback((videoId, rating) => {
    if (!isLocal) return;

    setRatings(prev => {
      const updated = { ...prev };
      if (rating === null || rating === 0) {
        delete updated[videoId];
      } else {
        updated[videoId] = rating;
      }
      return updated;
    });

    fetch('http://localhost:3001/api/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, rating }),
    })
      .then(res => res.json())
      .then(data => { if (data && typeof data === 'object' && !data.error) setRatings(data); })
      .catch(console.error);
  }, [isLocal]);

  const [shuffleActive, setShuffleActive] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(1);

  const [selectedVideo, setSelectedVideo] = useState(null);
  const [gridColumns, setGridColumns] = useState(3);
  const [showScripts, setShowScripts] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [playerMode, setPlayerMode] = useState('normal');
  const [isMonitorSize, setIsMonitorSize] = useState(false);
  const [isMiniPlayer, setIsMiniPlayer] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState(-1);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

  // Queue / Autoplay state
  const [queue, setQueue] = useState([]);
  const [autoplay, setAutoplay] = useState(true);

  useEffect(() => {
    document.documentElement.style.zoom = isMonitorSize ? '1.75' : '1';
  }, [isMonitorSize]);

  // Reset highlight when search query changes
  useEffect(() => {
    setSearchHighlight(-1);
  }, [searchQuery]);

  // Parse grouped data
  const { allVideos, groups, groupMeta } = useMemo(() => {
    const grps = Object.keys(videosData.groups || {});
    const meta = {};
    const all = [];

    grps.forEach((groupName) => {
      const group = videosData.groups[groupName];
      const catNames = Object.keys(group.categories || {});
      const catMeta = {};

      catNames.forEach((catName) => {
        const playlists = Object.keys(group.categories[catName] || {});
        catMeta[catName] = { playlists };

        playlists.forEach((plName) => {
          const vids = group.categories[catName][plName] || [];
          vids.forEach((v) => all.push(v));
        });
      });

      meta[groupName] = {
        icon: group.icon || '',
        categories: catNames,
        catMeta,
      };
    });

    return { allVideos: all, groups: grps, groupMeta: meta };
  }, []);

  // Latest videos — sorted by date, top 20
  const latestVideos = useMemo(() => {
    let vids = [...allVideos].filter((v) => v.date);
    if (activeResolution !== 'All') {
      vids = vids.filter((v) => v.resolution === activeResolution);
    }
    return vids.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);
  }, [allVideos, activeResolution]);

  // Available resolutions
  const availableResolutions = useMemo(() => {
    const resSet = new Set();
    allVideos.forEach((v) => {
      if (v.resolution) resSet.add(v.resolution);
    });
    // Sort by quality descending
    const order = ['8K', '4K', '2K', '1080p', '720p', '480p', '360p'];
    return order.filter((r) => resSet.has(r));
  }, [allVideos]);

  // Available ratings
  const availableRatings = useMemo(() => {
    const rSet = new Set();
    Object.values(ratings).forEach((r) => {
      if (r > 0) rSet.add(r);
    });
    return Array.from(rSet).sort((a, b) => b - a);
  }, [ratings]);

  // Active categories and playlists
  const activeCategories = useMemo(() => {
    if (activeGroup === 'All') return [];
    return groupMeta[activeGroup]?.categories || [];
  }, [activeGroup, groupMeta]);

  const activePlaylists = useMemo(() => {
    if (activeGroup === 'All' || activeCategory === 'All') return [];
    return groupMeta[activeGroup]?.catMeta?.[activeCategory]?.playlists || [];
  }, [activeGroup, activeCategory, groupMeta]);

  // Video counts
  const videoCounts = useMemo(() => {
    const counts = { total: allVideos.length, groups: {}, categories: {}, playlists: {} };

    groups.forEach((groupName) => {
      let groupTotal = 0;
      const group = videosData.groups[groupName];

      Object.entries(group.categories || {}).forEach(([catName, catPlaylists]) => {
        let catTotal = 0;

        Object.entries(catPlaylists || {}).forEach(([plName, vids]) => {
          counts.playlists[`${groupName}::${catName}::${plName}`] = vids.length;
          catTotal += vids.length;
        });

        counts.categories[`${groupName}::${catName}`] = catTotal;
        groupTotal += catTotal;
      });

      counts.groups[groupName] = groupTotal;
    });

    return counts;
  }, [allVideos, groups]);

  // Filtered videos
  const filteredVideos = useMemo(() => {
    let videos;

    // When a tag is active, search across all videos (bypass group/category/playlist)
    if (activeTag && tags[activeTag]) {
      videos = allVideos.filter(v => tags[activeTag].includes(v.youtubeLinkID));
    } else if (activeGroup === 'All' || !videosData.groups[activeGroup]) {
      videos = allVideos;
    } else {
      const group = videosData.groups[activeGroup];

      if (activeCategory === 'All') {
        videos = [];
        Object.values(group.categories || {}).forEach((cat) => {
          Object.values(cat || {}).forEach((vids) => {
            vids.forEach((v) => videos.push(v));
          });
        });
      } else if (activePlaylist === 'All') {
        videos = [];
        const cat = group.categories[activeCategory] || {};
        Object.values(cat).forEach((vids) => {
          vids.forEach((v) => videos.push(v));
        });
      } else {
        videos = group.categories?.[activeCategory]?.[activePlaylist] || [];
      }
    }

    if (isFavoritesMode) {
      videos = videos.filter(v => favorites.includes(v.youtubeLinkID));
    }


    if (searchQuery.trim()) {
      let q = searchQuery.toLowerCase().trim();
      let resFilter = null;
      let afterFilter = null;
      let typeFilter = null;

      // Extract inline filters
      const resMatch = q.match(/res:(\S+)/);
      if (resMatch) {
        resFilter = resMatch[1];
        q = q.replace(resMatch[0], '').trim();
      }

      const afterMatch = q.match(/after:(\d{4})/);
      if (afterMatch) {
        afterFilter = parseInt(afterMatch[1], 10);
        q = q.replace(afterMatch[0], '').trim();
      }

      const typeMatch = q.match(/type:(\S+)/);
      if (typeMatch) {
        typeFilter = typeMatch[1];
        q = q.replace(typeMatch[0], '').trim();
      }

      const ratingMatch = q.match(/rating:(\d+)/);
      let ratingFilter = null;
      if (ratingMatch) {
        ratingFilter = parseInt(ratingMatch[1], 10);
        q = q.replace(ratingMatch[0], '').trim();
      }

      videos = videos.filter((v) => {
        // Apply parsed inline filters
        if (resFilter && (!v.resolution || v.resolution.toLowerCase() !== resFilter)) return false;
        if (afterFilter) {
          if (!v.date) return false;
          const year = new Date(v.date).getFullYear();
          if (year < afterFilter) return false;
        }
        if (typeFilter && (!v.type || !v.type.toLowerCase().includes(typeFilter))) return false;
        if (ratingFilter) {
          const r = ratings[v.youtubeLinkID] || 0;
          if (r !== ratingFilter) return false;
        }

        // Default query: title + type combined
        if (q) {
          const combinedText = `${v.title || ''} ${v.type || ''}`.toLowerCase();
          if (!combinedText.includes(q)) return false;
        }

        return true;
      });
    }

    if (activeResolution !== 'All') {
      videos = videos.filter((v) => v.resolution === activeResolution);
    }

    if (shuffleActive) {
      const rng = pseudoRandom(shuffleSeed);
      const shuffled = [...videos];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      videos = shuffled;
    } else if (activeSort === 'Highest Rated') {
      videos.sort((a, b) => (ratings[b.youtubeLinkID] || 0) - (ratings[a.youtubeLinkID] || 0));
    } else if (activeSort === 'Lowest Rated') {
      videos.sort((a, b) => (ratings[a.youtubeLinkID] || 0) - (ratings[b.youtubeLinkID] || 0));
    } else if (activeSort === 'Newest First') {
      videos.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    } else if (activeSort === 'Oldest First') {
      videos.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    }

    return videos;
  }, [activeGroup, activeCategory, activePlaylist, activeResolution, activeSort, searchQuery, allVideos, shuffleActive, shuffleSeed, isFavoritesMode, favorites, activeTag, tags, ratings]);

  // Is home view (no filters active, no search)
  const isHomeView = activeGroup === 'All' && !searchQuery.trim() && !isFavoritesMode && !activeTag;

  // Check if any filter is active
  const hasActiveFilters = activeGroup !== 'All' || activeResolution !== 'All' || searchQuery.trim() || isFavoritesMode || activeTag !== null;

  const handleGroupChange = useCallback((group) => {
    setFilters({ group, category: 'All', playlist: 'All' });
  }, [setFilters]);

  const handleCategoryChange = useCallback((cat) => {
    setFilters({ category: cat, playlist: 'All' });
  }, [setFilters]);

  const handleReset = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setShuffleActive(false);
    setIsFavoritesMode(false);
    setActiveTag(null);
  }, [setFilters]);

  const handleToggleShuffle = useCallback(() => {
    setShuffleActive(prev => {
      if (!prev) setShuffleSeed(Date.now());
      return !prev;
    });
  }, []);

  // Build queue from the current filtered video pool
  const buildQueue = useCallback((video, videos) => {
    if (!video || !videos) return [];
    const idx = videos.findIndex(v => v.youtubeLinkID === video.youtubeLinkID);
    // Preserve the current sort order: show items after the selected video first,
    // then wrap around to items before it.
    if (idx >= 0) {
      return [...videos.slice(idx + 1), ...videos.slice(0, idx)];
    }
    return videos.filter(v => v.youtubeLinkID !== video.youtubeLinkID);
  }, []);

  const handleVideoSelect = useCallback((video) => {
    setSelectedVideo(video);
    setQueue(buildQueue(video, filteredVideos));
  }, [filteredVideos, buildQueue]);

  const handleClosePlayer = useCallback(() => {
    setSelectedVideo(null);
    setIsMiniPlayer(false);
    setQueue([]);
  }, []);

  const handleAdvance = useCallback(() => {
    if (queue.length === 0) return;
    const nextVideo = queue[0];
    const remainingQueue = queue.slice(1);
    // Append more videos based on the new currentVideo to keep the queue populated
    const usedIds = new Set([nextVideo.youtubeLinkID, ...remainingQueue.map(q => q.youtubeLinkID)]);
    const newRelated = filteredVideos
      .filter(v => !usedIds.has(v.youtubeLinkID))
      .slice(0, 5);
    setSelectedVideo(nextVideo);
    setQueue([...remainingQueue, ...newRelated].slice(0, 15));
  }, [queue, filteredVideos]);

  const handleQueueReorder = useCallback((newQueue) => {
    setQueue(newQueue);
  }, []);

  const handleQueueRemove = useCallback((idx) => {
    setQueue(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleToggleAutoplay = useCallback(() => {
    setAutoplay(prev => !prev);
  }, []);

  // ⌘K keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="app">
      <div className="sticky-nav">
        {/* Header */}
        <header className="header">
          <div className="header__top-row">
            <div className="header__brand" onClick={handleReset} style={{ cursor: 'pointer' }}>
              <div className="header__play-btn">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className="header__brand-text">
                <h1 className="header__logo">YouTube</h1>
                <span className="header__tagline">Library</span>
              </div>
            </div>
            <div className="header__search">
              <svg className="header__search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                id="search-input"
                type="text"
                className="header__search-input"
                placeholder="Search videos..."
                value={searchQuery}
                onChange={(e) => setFilters({ search: e.target.value })}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 250)}
                onKeyDown={(e) => {
                  const suggestions = filteredVideos.slice(0, 6);
                  if (!isSearchFocused || !searchQuery.trim() || suggestions.length === 0) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSearchHighlight(prev => prev < suggestions.length - 1 ? prev + 1 : 0);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSearchHighlight(prev => prev > 0 ? prev - 1 : suggestions.length - 1);
                  } else if (e.key === 'Enter' && searchHighlight >= 0) {
                    e.preventDefault();
                    const selected = suggestions[searchHighlight];
                    if (selected) {
                      handleVideoSelect(selected);
                      setIsSearchFocused(false);
                      document.getElementById('search-input')?.blur();
                    }
                  }
                }}
                autoComplete="off"
              />
              <div className="header__search-actions">
                <button
                  className="header__search-tips"
                  title="Advanced Search Filters"
                  onClick={() => setShowAdvancedSearch(true)}
                  aria-label="Advanced Search Filters"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                </button>

                {searchQuery ? (
                  <button
                    className="header__search-clear"
                    onClick={() => setFilters({ search: '' })}
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                ) : (
                  <kbd className="header__search-kbd">⌘K</kbd>
                )}
              </div>

              {/* Apple-Style Search Suggestions Dropdown */}
              {isSearchFocused && searchQuery.trim() && (
                <div className="search-dropdown">
                  {filteredVideos.length > 0 ? (
                    <>
                      <div className="search-dropdown__header">
                        <span className="search-dropdown__section-title">Top Results</span>
                        <span className="search-dropdown__count">{filteredVideos.length} found</span>
                      </div>
                      <div className="search-dropdown__list">
                        {filteredVideos.slice(0, 6).map((v, idx) => {
                          // Highlight matching text
                          const query = searchQuery.toLowerCase().replace(/res:\S+|after:\d{4}|type:\S+/g, '').trim();
                          let titleParts = [v.title];
                          if (query) {
                            const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                            titleParts = v.title.split(regex);
                          }
                          return (
                            <div
                              key={v.youtubeLinkID || v.title}
                              className={`search-dropdown__item ${idx === searchHighlight ? 'search-dropdown__item--active' : ''}`}
                              onMouseDown={() => {
                                handleVideoSelect(v);
                                setIsSearchFocused(false);
                              }}
                              onMouseEnter={() => setSearchHighlight(idx)}
                            >
                              <div className="search-dropdown__thumb-wrap">
                                <img
                                  className="search-dropdown__thumb"
                                  src={v.thumbnail}
                                  alt=""
                                  loading="lazy"
                                />
                                {v.duration && (
                                  <span className="search-dropdown__duration">{v.duration}</span>
                                )}
                              </div>
                              <div className="search-dropdown__info">
                                <span className="search-dropdown__title">
                                  {titleParts.map((part, i) =>
                                    part.toLowerCase() === query.toLowerCase()
                                      ? <mark key={i} className="search-dropdown__highlight">{part}</mark>
                                      : <span key={i}>{part}</span>
                                  )}
                                </span>
                                <div className="search-dropdown__meta">
                                  {v.group && v.category && (
                                    <span className="search-dropdown__category">{v.group} › {v.category}</span>
                                  )}
                                  {v.resolution && (
                                    <span className={`search-dropdown__badge ${v.resolution === '8K' ? 'search-dropdown__badge--8k' : v.resolution === '4K' ? 'search-dropdown__badge--4k' : ''}`}>
                                      {v.resolution}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="search-dropdown__action">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="9 18 15 12 9 6" />
                                </svg>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {filteredVideos.length > 6 && (
                        <div className="search-dropdown__footer">
                          <span>Show all {filteredVideos.length} results</span>
                          <kbd className="search-dropdown__footer-kbd">↵</kbd>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="search-dropdown__empty">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        <line x1="8" y1="11" x2="14" y2="11" />
                      </svg>
                      <span className="search-dropdown__empty-title">No Results</span>
                      <span className="search-dropdown__empty-subtitle">Try a different search term</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="header__right">
              <button
                className="header__analytics-btn"
                onClick={() => setShowAnalytics(true)}
                title="View Analytics"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="18" y="3" width="4" height="18"></rect>
                  <rect x="10" y="8" width="4" height="13"></rect>
                  <rect x="2" y="13" width="4" height="8"></rect>
                </svg>
                <span>Analytics</span>
              </button>
              <button
                className="header__scripts-btn"
                onClick={() => setIsMonitorSize(!isMonitorSize)}
                title={isMonitorSize ? "Switch to Laptop Size (100%)" : "Switch to Monitor Size (175%)"}
                style={{ padding: '8px' }}
              >
                {isMonitorSize ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <path d="M8 21h8" />
                    <path d="M12 17v4" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <path d="M2 20h20" />
                  </svg>
                )}
              </button>
              <button
                className="header__scripts-btn"
                onClick={() => setShowScripts(true)}
                title="Scripts & Data"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Filter Bar */}
        <FilterBar
          groups={groups}
          groupMeta={groupMeta}
          activeGroup={activeGroup}
          onGroupChange={handleGroupChange}
          categories={activeCategories}
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          playlists={activePlaylists}
          activePlaylist={activePlaylist}
          onPlaylistChange={(playlist) => setFilters({ playlist })}
          availableResolutions={availableResolutions}
          activeResolution={activeResolution}
          onResolutionChange={(resolution) => setFilters({ resolution })}
          activeSort={activeSort}
          onSortChange={(sort) => setFilters({ sort })}
          searchQuery={searchQuery}
          onSearchChange={(search) => setFilters({ search })}
          videoCounts={videoCounts}
          gridColumns={gridColumns}
          onGridColumnsChange={setGridColumns}
          hasActiveFilters={hasActiveFilters}
          onReset={handleReset}
          shuffleActive={shuffleActive}
          onToggleShuffle={handleToggleShuffle}
          onQuickAccess={(group, category, resolution) => {
            setFilters({ group, category, playlist: 'All', resolution });
          }}
          isLocal={isLocal}
          isFavoritesMode={isFavoritesMode}
          onToggleFavoritesMode={() => setIsFavoritesMode(prev => !prev)}
        />
      </div>

      {/* Home View: Latest Videos */}
      {isHomeView && latestVideos.length > 0 && (
        <section className="home-section">
          <div className="home-section__header">
            <span className="home-section__title">Recently Added</span>
            <div className="home-section__line" />
          </div>
          <VideoGrid
            videos={latestVideos}
            onVideoSelect={handleVideoSelect}
            gridColumns={gridColumns}
            isLocal={isLocal}
            favorites={favorites}
            onToggleFav={handleToggleFav}
            tags={tags}
            onToggleTag={handleToggleTag}
            ratings={ratings}
            onSetRating={handleSetRating}
          />
        </section>
      )}

      {/* Filtered View */}
      {!isHomeView && (
        <VideoGrid
          videos={filteredVideos}
          onVideoSelect={handleVideoSelect}
          gridColumns={gridColumns}
          isLocal={isLocal}
          favorites={favorites}
          onToggleFav={handleToggleFav}
          tags={tags}
          onToggleTag={handleToggleTag}
          ratings={ratings}
          onSetRating={handleSetRating}
        />
      )}

      {/* Player Modal */}
      {selectedVideo && (
        <Player
          video={selectedVideo}
          allVideos={allVideos}
          onVideoSelect={handleVideoSelect}
          onClose={handleClosePlayer}
          isMiniPlayer={isMiniPlayer}
          onToggleMini={() => setIsMiniPlayer((prev) => !prev)}
          queue={queue}
          autoplay={autoplay}
          onAdvance={handleAdvance}
          onQueueReorder={handleQueueReorder}
          onQueueRemove={handleQueueRemove}
          onToggleAutoplay={handleToggleAutoplay}
        />
      )}
      {/* Scripts Modal */}
      {showScripts && (
        <ScriptsPage onClose={() => setShowScripts(false)} />
      )}

      {/* Analytics Modal */}
      {showAnalytics && (
        <AnalyticsDashboard
          onClose={() => setShowAnalytics(false)}
          videos={filteredVideos}
          allVideos={allVideos}
          favorites={favorites}
          isMonitorSize={isMonitorSize}
          onFilterUpdate={(type, value) => {
            if (type === 'group') setFilters({ group: value, category: 'All', playlist: 'All' });
            else if (type === 'category') setFilters({ category: value, playlist: 'All' });
            else if (type === 'resolution') setFilters({ resolution: value });
            else if (type === 'type') {
               const q = searchQuery.replace(/type:\S+/g, '').trim();
               const typeVal = value.split(' ')[0].toLowerCase();
               setFilters({ search: (q ? q + ' ' : '') + `type:${typeVal}` });
            }
          }}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={handleReset}
        />
      )}

      <AdvancedSearchPanel
        isOpen={showAdvancedSearch}
        onClose={() => setShowAdvancedSearch(false)}
        searchQuery={searchQuery}
        onSearchChange={(search) => setFilters({ search })}
        availableResolutions={availableResolutions}
        allVideos={allVideos}
        tags={tags}
        activeTag={activeTag}
        onTagChange={setActiveTag}
        availableRatings={availableRatings}
      />
    </div>
  );
}

export default App;
