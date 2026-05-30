import React, { useState, useEffect, useRef } from 'react';

const FALLBACK_THUMBNAIL = 'data:image/svg+xml,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="640" height="360" fill="#1e1e1e"/>
  <g transform="translate(320,180)">
    <circle r="40" fill="none" stroke="#333" stroke-width="3"/>
    <polygon points="-12,-20 -12,20 20,0" fill="#444"/>
  </g>
  <text x="320" y="240" text-anchor="middle" fill="#555" font-family="sans-serif" font-size="14">Thumbnail unavailable</text>
</svg>`);

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Upcoming';
    if (diffDays < 1) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''} ago`;
    }
    const years = Math.floor(diffDays / 365);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  } catch {
    return dateStr;
  }
}

function formatAbsoluteDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function VideoCard({ video, onClick, index, isLocal, isFav, onToggleFav, tags, onToggleTag, rating, onSetRating }) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Hover Preview State
  const [showIframe, setShowIframe] = useState(false);
  const hoverTimeoutRef = useRef(null);

  // Tag popover state
  const [showTagPopover, setShowTagPopover] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const tagPopoverRef = useRef(null);

  // Rating popover state
  const [showRatingPopover, setShowRatingPopover] = useState(false);
  const ratingPopoverRef = useRef(null);

  const animationDelay = `${Math.min(index * 0.03, 0.5)}s`;

  const thumbnailSrc = imgError
    ? FALLBACK_THUMBNAIL
    : (video.thumbnail || `https://img.youtube.com/vi/${video.youtubeLinkID}/maxresdefault.jpg`);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setShowIframe(true);
    }, 2000);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setShowIframe(false);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // Close popovers on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showTagPopover && tagPopoverRef.current && !tagPopoverRef.current.contains(e.target)) {
        setShowTagPopover(false);
        setNewTagInput('');
      }
      if (showRatingPopover && ratingPopoverRef.current && !ratingPopoverRef.current.contains(e.target)) {
        setShowRatingPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTagPopover, showRatingPopover]);

  // Get tags for this video
  const videoTags = tags ? Object.entries(tags).filter(([, ids]) => ids.includes(video.youtubeLinkID)).map(([name]) => name) : [];
  const allTagNames = tags ? Object.keys(tags).sort() : [];

  const handleCreateTag = (e) => {
    e.preventDefault();
    const tagName = newTagInput.trim().toLowerCase();
    if (!tagName || !onToggleTag) return;
    onToggleTag(tagName, video.youtubeLinkID);
    setNewTagInput('');
  };

  return (
    <div
      id={`video-${video.youtubeLinkID}`}
      className="video-card"
      onClick={() => onClick(video)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ animationDelay }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(video);
        }
      }}
    >
      {/* Thumbnail */}
      <div className="video-card__thumbnail-wrapper">
        {!imgLoaded && !imgError && (
          <div className="video-card__thumbnail-skeleton" />
        )}
        <img
          className={`video-card__thumbnail ${imgLoaded ? 'video-card__thumbnail--loaded' : ''}`}
          src={thumbnailSrc}
          alt={video.title}
          loading="lazy"
          onLoad={(e) => {
            // YouTube returns a tiny 120x90 gray placeholder when maxresdefault doesn't exist
            if (e.target.naturalWidth <= 120 && e.target.src.includes('maxresdefault')) {
              e.target.src = `https://img.youtube.com/vi/${video.youtubeLinkID}/sddefault.jpg`;
              return;
            }
            if (e.target.naturalWidth <= 120 && e.target.src.includes('sddefault')) {
              e.target.src = `https://img.youtube.com/vi/${video.youtubeLinkID}/hqdefault.jpg`;
              return;
            }
            if (e.target.naturalWidth <= 120 && e.target.src.includes('hqdefault')) {
              e.target.src = `https://img.youtube.com/vi/${video.youtubeLinkID}/mqdefault.jpg`;
              return;
            }
            setImgLoaded(true);
          }}
          onError={(e) => {
            if (e.target.src.includes('maxresdefault')) {
              e.target.src = `https://img.youtube.com/vi/${video.youtubeLinkID}/sddefault.jpg`;
            } else if (e.target.src.includes('sddefault')) {
              e.target.src = `https://img.youtube.com/vi/${video.youtubeLinkID}/hqdefault.jpg`;
            } else if (e.target.src.includes('hqdefault')) {
              e.target.src = `https://img.youtube.com/vi/${video.youtubeLinkID}/mqdefault.jpg`;
            } else {
              setImgError(true);
              setImgLoaded(true);
            }
          }}
        />

        {showIframe && (
          <div className="video-card__iframe-overlay" style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none', background: '#000' }}>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${video.youtubeLinkID}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&loop=1&playlist=${video.youtubeLinkID}&modestbranding=1&playsinline=1&iv_load_policy=3&showinfo=0&rel=0`}
              frameBorder="0"
              allow="autoplay; encrypted-media"
              style={{ width: '100%', height: '100%', pointerEvents: 'none', transform: 'scale(1.15)', transformOrigin: 'center' }}
            />
          </div>
        )}

        {/* Watch indicator line */}
        <div className="video-card__progress" />

        {/* Play overlay */}
        <div className="video-card__play-overlay">
          <div className="video-card__play-icon">
            <svg viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Duration badge */}
        {video.duration && (
          <span className="video-card__duration">{video.duration}</span>
        )}

        {/* Favorites button */}
        {isLocal && (
          <button 
            className={`video-card__fav-btn ${isFav ? 'video-card__fav-btn--active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleFav(video); }}
            title={isFav ? "Remove from Favorites" : "Add to Favorites"}
          >
            <svg viewBox="0 0 24 24" fill={isFav ? "#ff2d55" : "rgba(0,0,0,0.4)"} stroke={isFav ? "#ff2d55" : "#fff"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>
        )}

        {/* Tag button (local only) */}
        {isLocal && (
          <button
            className={`video-card__tag-btn ${videoTags.length > 0 ? 'video-card__tag-btn--active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setShowTagPopover(prev => !prev); }}
            title="Manage Tags"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
              <line x1="7" y1="7" x2="7.01" y2="7"></line>
            </svg>
            {videoTags.length > 0 && (
              <span className="video-card__tag-count">{videoTags.length}</span>
            )}
          </button>
        )}

        {/* Rating Button */}
        {isLocal && (
          <button
            className={`video-card__rating-btn ${rating > 0 ? 'video-card__rating-btn--active' : ''}`}
            onClick={(e) => { 
              e.stopPropagation(); 
              setShowRatingPopover(prev => !prev);
              setShowTagPopover(false);
            }}
            title="Set Rating"
          >
            <span style={{color: rating >= 8 ? '#1ed760' : (rating > 0 ? '#fff' : 'rgba(255,255,255,0.6)')}}>★</span>
            {rating > 0 && <span className="video-card__rating-val">{rating}</span>}
          </button>
        )}

      </div>

      {/* Tag Popover – rendered at card level to escape thumbnail overflow:hidden */}
      {showTagPopover && isLocal && (
        <div className="video-card__tag-popover" ref={tagPopoverRef} onClick={(e) => e.stopPropagation()}>
          <div className="video-card__tag-popover-header">
            <span>Tags</span>
            <button className="video-card__tag-popover-close" onClick={() => { setShowTagPopover(false); setNewTagInput(''); }}>✕</button>
          </div>
          <form className="video-card__tag-input-wrap" onSubmit={handleCreateTag}>
            <input
              className="video-card__tag-input"
              type="text"
              placeholder="New tag..."
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
            {newTagInput.trim() && (
              <button type="submit" className="video-card__tag-add-btn">+</button>
            )}
          </form>
          <div className="video-card__tag-list">
            {allTagNames.length === 0 && !newTagInput.trim() && (
              <div className="video-card__tag-empty">No tags yet. Create one above.</div>
            )}
            {allTagNames.map(tagName => {
              const isTagged = tags[tagName]?.includes(video.youtubeLinkID);
              return (
                <button
                  key={tagName}
                  className={`video-card__tag-item ${isTagged ? 'video-card__tag-item--active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onToggleTag(tagName, video.youtubeLinkID); }}
                >
                  <span className="video-card__tag-check">{isTagged ? '✓' : ''}</span>
                  <span className="video-card__tag-name">{tagName}</span>
                  <span className="video-card__tag-badge">{tags[tagName]?.length || 0}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Rating Popover */}
      {showRatingPopover && isLocal && (
        <div className="video-card__rating-popover" ref={ratingPopoverRef} onClick={(e) => e.stopPropagation()}>
          <div className="video-card__tag-popover-header">
            <span>Rating (out of 10)</span>
            <button className="video-card__tag-popover-close" onClick={() => setShowRatingPopover(false)}>✕</button>
          </div>
          <div className="video-card__rating-grid">
             {[...Array(10)].map((_, i) => {
                const score = i + 1;
                return (
                  <button 
                    key={score} 
                    className={`video-card__rating-num ${rating === score ? 'video-card__rating-num--active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onSetRating(video.youtubeLinkID, score); setShowRatingPopover(false); }}
                  >
                    {score}
                  </button>
                )
             })}
          </div>
          <button 
             className="video-card__rating-clear"
             onClick={(e) => { e.stopPropagation(); onSetRating(video.youtubeLinkID, 0); setShowRatingPopover(false); }}
          >
             Clear Rating
          </button>
        </div>
      )}

      {/* Info */}
      <div className="video-card__info">
        <h3 className="video-card__title" title={video.title}>{video.title}</h3>
        <div className="video-card__meta">
          <span className="video-card__category">{video.type}</span>
          {video.date && (
            <span className="video-card__date" title={formatAbsoluteDate(video.date)}>
              {formatDate(video.date)}
            </span>
          )}
          {rating > 0 && (
            <span className="video-card__resolution video-card__rating-badge">★ {rating}/10</span>
          )}
          {video.resolution && (
            <span className="video-card__resolution">{video.resolution}</span>
          )}
        </div>
      </div>
    </div>
  );
}
