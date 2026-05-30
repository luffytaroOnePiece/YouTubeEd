import React, { useEffect, useCallback, useState, useRef } from 'react';
import YouTube from 'react-youtube';
import RelatedPanel from './RelatedPanel';
import QueuePanel from './QueuePanel';

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

export default function Player({
  video,
  allVideos,
  onVideoSelect,
  onClose,
  isMiniPlayer,
  onToggleMini,
  queue,
  autoplay,
  onAdvance,
  onQueueReorder,
  onQueueRemove,
  onToggleAutoplay
}) {
  const [sidebarTab, setSidebarTab] = useState('queue'); // 'queue' | 'related'
  const [upNextCountdown, setUpNextCountdown] = useState(null); // null or { seconds, video }
  const countdownRef = useRef(null);
  const overlayRef = useRef(null);
  const wasFullscreenRef = useRef(false); // tracks fullscreen intent across autoplay
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fullscreen toggle
  const enterFullscreen = useCallback(() => {
    const el = overlayRef.current;
    if (!el) return;
    const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (rfs) rfs.call(el).catch(() => {});
  }, []);

  const exitFullscreen = useCallback(() => {
    const exitFs = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if (exitFs && document.fullscreenElement) exitFs.call(document).catch(() => {});
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [enterFullscreen, exitFullscreen]);

  // Track fullscreen state changes
  useEffect(() => {
    const handleFsChange = () => {
      const inFs = !!document.fullscreenElement;
      setIsFullscreen(inFs);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  // Close on ESC (only when not in fullscreen — browser handles ESC for fullscreen)
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          // Let the browser handle exiting fullscreen; don't close player
          return;
        }
        if (upNextCountdown) {
          cancelCountdown();
        } else {
          onClose();
        }
      }
    },
    [onClose, upNextCountdown]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    if (!isMiniPlayer) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown, isMiniPlayer]);

  // Cleanup countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const cancelCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
    setUpNextCountdown(null);
  }, []);

  const handleVideoEnd = useCallback(() => {
    if (!autoplay || !queue || queue.length === 0) return;

    // Capture fullscreen state BEFORE advancing
    wasFullscreenRef.current = !!document.fullscreenElement;

    const nextVideo = queue[0];
    setUpNextCountdown({ seconds: 3, video: nextVideo });

    let secs = 3;
    countdownRef.current = setInterval(() => {
      secs -= 1;
      if (secs <= 0) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
        setUpNextCountdown(null);
        onAdvance();
      } else {
        setUpNextCountdown({ seconds: secs, video: nextVideo });
      }
    }, 1000);
  }, [autoplay, queue, onAdvance]);

  // Re-enter fullscreen after autoplay advances and new video is ready
  const handlePlayerReady = useCallback((event) => {
    // Force highest available quality
    const player = event.target;
    try {
      const levels = player.getAvailableQualityLevels();
      if (levels && levels.length > 0) {
        player.setPlaybackQuality(levels[0]); // highest available
      }
    } catch (e) { /* ignore */ }

    if (wasFullscreenRef.current) {
      // Small delay to let the iframe settle before requesting fullscreen
      setTimeout(() => {
        enterFullscreen();
      }, 300);
      wasFullscreenRef.current = false;
    }
  }, [enterFullscreen]);

  if (!video) return null;

  const youtubeOpts = {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 1,
      modestbranding: 1,
      rel: 0,
      vq: 'hd2160', // request highest available resolution
    },
  };

  const youtubeUrl = `https://www.youtube.com/watch?v=${video.youtubeLinkID}`;

  return (
    <div
      ref={overlayRef}
      className={`player-overlay ${isMiniPlayer ? 'mini' : ''} ${isFullscreen ? 'player-overlay--fullscreen' : ''}`}
      onClick={(e) => {
        if (!isMiniPlayer && !isFullscreen && e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`player-modal ${!isMiniPlayer ? 'player-modal--with-sidebar' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="player-modal__main">
          {/* Header */}
          <div className="player-modal__header">
            <h2 className="player-modal__title">{video.title}</h2>
            <div className="player-modal__actions">
              {!isMiniPlayer && (
                <button
                  className="player-modal__btn"
                  onClick={() => {
                    navigator.clipboard.writeText(youtubeUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  title="Copy YouTube Link"
                >
                  {copied ? '✓ Copied' : '⎘ Copy'}
                </button>
              )}
              {!isMiniPlayer && (
                <a
                  href={youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="player-modal__btn"
                  title="Open in YouTube"
                >
                  ↗ YouTube
                </a>
              )}
              {!isMiniPlayer && queue && queue.length > 0 && (
                <button
                  className="player-modal__close"
                  onClick={() => {
                    if (upNextCountdown) cancelCountdown();
                    onAdvance();
                  }}
                  aria-label="Next video"
                  title="Next Video"
                >
                  →
                </button>
              )}
              {!isMiniPlayer && (
                <button
                  className="player-modal__close"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="4 14 10 14 10 20" />
                      <polyline points="20 10 14 10 14 4" />
                      <line x1="14" y1="10" x2="21" y2="3" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 3 21 3 21 9" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  )}
                </button>
              )}
              <button
                className="player-modal__close"
                onClick={onToggleMini}
                aria-label={isMiniPlayer ? "Expand player" : "Minimize player"}
                title={isMiniPlayer ? "Expand" : "Minimize"}
              >
                {isMiniPlayer ? '↖' : '↘'}
              </button>
              <button
                id="player-close-btn"
                className="player-modal__close"
                onClick={onClose}
                aria-label="Close player"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Video */}
          <div className="player-modal__video">
            <YouTube
              videoId={video.youtubeLinkID}
              opts={youtubeOpts}
              onEnd={handleVideoEnd}
              onReady={handlePlayerReady}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            />

            {/* Up Next Countdown Overlay */}
            {upNextCountdown && (
              <div className="player-modal__up-next">
                <div className="player-modal__up-next-card">
                  <div className="player-modal__up-next-header">
                    <span className="player-modal__up-next-label">Up Next</span>
                    <span className="player-modal__up-next-timer">
                      <svg className="player-modal__up-next-ring" width="28" height="28" viewBox="0 0 28 28">
                        <circle cx="14" cy="14" r="12" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2.5" />
                        <circle
                          cx="14" cy="14" r="12"
                          fill="none"
                          stroke="#fff"
                          strokeWidth="2.5"
                          strokeDasharray={2 * Math.PI * 12}
                          strokeDashoffset={2 * Math.PI * 12 * (1 - upNextCountdown.seconds / 3)}
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dashoffset 1s linear', transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                        />
                      </svg>
                      <span className="player-modal__up-next-sec">{upNextCountdown.seconds}</span>
                    </span>
                  </div>
                  <div className="player-modal__up-next-info">
                    <img
                      className="player-modal__up-next-thumb"
                      src={`https://img.youtube.com/vi/${upNextCountdown.video.youtubeLinkID}/mqdefault.jpg`}
                      alt=""
                    />
                    <span className="player-modal__up-next-title">{upNextCountdown.video.title}</span>
                  </div>
                  <button className="player-modal__up-next-cancel" onClick={cancelCountdown}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="player-modal__info">
            <span className="player-modal__category-tag">{video.type}</span>
            {video.date && (
              <span className="player-modal__date" title={video.date}>
                {formatDate(video.date)}
              </span>
            )}
            {video.duration && (
              <span className="player-modal__date">⏱ {video.duration}</span>
            )}
          </div>
        </div>
        
        {!isMiniPlayer && (
          <div className="player-modal__sidebar-wrapper">
            <div className="player-sidebar">
              {/* Apple-style Segmented Control */}
              <div className="player-sidebar__tabs">
                <button
                  className={`player-sidebar__tab ${sidebarTab === 'queue' ? 'player-sidebar__tab--active' : ''}`}
                  onClick={() => setSidebarTab('queue')}
                >
                  Up Next
                  {queue && queue.length > 0 && (
                    <span className="player-sidebar__tab-count">{queue.length}</span>
                  )}
                </button>
                <button
                  className={`player-sidebar__tab ${sidebarTab === 'related' ? 'player-sidebar__tab--active' : ''}`}
                  onClick={() => setSidebarTab('related')}
                >
                  Related
                </button>
              </div>

              {/* Tab Content */}
              <div className="player-sidebar__content">
                {sidebarTab === 'queue' ? (
                  <QueuePanel
                    queue={queue || []}
                    onReorder={onQueueReorder}
                    onRemove={onQueueRemove}
                    onSelect={onVideoSelect}
                    autoplay={autoplay}
                    onToggleAutoplay={onToggleAutoplay}
                    currentVideo={video}
                  />
                ) : (
                  <RelatedPanel
                    currentVideo={video}
                    allVideos={allVideos}
                    onVideoSelect={onVideoSelect}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
