import React, { useState, useRef, useCallback } from 'react';

export default function QueuePanel({ queue, onReorder, onRemove, onSelect, autoplay, onToggleAutoplay, currentVideo }) {
  const handleShuffle = useCallback(() => {
    if (!queue || queue.length < 2) return;
    const shuffled = [...queue];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    onReorder(shuffled);
  }, [queue, onReorder]);

  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragNode = useRef(null);

  const handleDragStart = useCallback((e, idx) => {
    dragNode.current = e.target;
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
    // Make the drag image slightly transparent
    setTimeout(() => {
      if (dragNode.current) dragNode.current.classList.add('queue-item--dragging');
    }, 0);
  }, []);

  const handleDragOver = useCallback((e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(idx);
  }, []);

  const handleDrop = useCallback((e, dropIdx) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIdx) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newQueue = [...queue];
    const [moved] = newQueue.splice(dragIndex, 1);
    newQueue.splice(dropIdx, 0, moved);
    onReorder(newQueue);
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, queue, onReorder]);

  const handleDragEnd = useCallback(() => {
    if (dragNode.current) dragNode.current.classList.remove('queue-item--dragging');
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  return (
    <div className="queue-panel">
      {/* Autoplay Toggle + Shuffle */}
      <div className="queue-panel__header">
        <span className="queue-panel__label">Autoplay</span>
        <div className="queue-panel__header-actions">
          {queue.length > 1 && (
            <button
              className="queue-panel__shuffle-btn"
              onClick={handleShuffle}
              aria-label="Shuffle queue"
              title="Shuffle"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 3 21 3 21 8" />
                <line x1="4" y1="20" x2="21" y2="3" />
                <polyline points="21 16 21 21 16 21" />
                <line x1="15" y1="15" x2="21" y2="21" />
                <line x1="4" y1="4" x2="9" y2="9" />
              </svg>
            </button>
          )}
          <button
            className={`queue-panel__autoplay-toggle ${autoplay ? 'queue-panel__autoplay-toggle--on' : ''}`}
            onClick={onToggleAutoplay}
            aria-label={autoplay ? 'Disable autoplay' : 'Enable autoplay'}
          >
            <span className="queue-panel__autoplay-knob" />
          </button>
        </div>
      </div>

      {/* Queue List */}
      {queue.length === 0 ? (
        <div className="queue-panel__empty">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <path d="M12 12h.01" />
            <path d="M17 12h.01" />
            <path d="M7 12h.01" />
          </svg>
          <span className="queue-panel__empty-title">Queue is empty</span>
          <span className="queue-panel__empty-sub">Videos will appear here as you browse</span>
        </div>
      ) : (
        <div className="queue-panel__list">
          {queue.map((video, idx) => (
            <div
              key={video.youtubeLinkID + '-' + idx}
              className={`queue-item ${dragOverIndex === idx ? 'queue-item--drag-over' : ''} ${dragIndex === idx ? 'queue-item--ghost' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              onClick={() => onSelect(video)}
            >
              <div className="queue-item__grip">
                <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                  <circle cx="3" cy="2" r="1.2" />
                  <circle cx="7" cy="2" r="1.2" />
                  <circle cx="3" cy="7" r="1.2" />
                  <circle cx="7" cy="7" r="1.2" />
                  <circle cx="3" cy="12" r="1.2" />
                  <circle cx="7" cy="12" r="1.2" />
                </svg>
              </div>
              <span className="queue-item__index">{idx + 1}</span>
              <div className="queue-item__thumb">
                <img
                  src={`https://img.youtube.com/vi/${video.youtubeLinkID}/mqdefault.jpg`}
                  alt=""
                  loading="lazy"
                />
                {video.duration && (
                  <span className="queue-item__duration">{video.duration}</span>
                )}
              </div>
              <div className="queue-item__info">
                <span className="queue-item__title" title={video.title}>{video.title}</span>
                <span className="queue-item__type">{video.type}</span>
              </div>
              <button
                className="queue-item__remove"
                onClick={(e) => { e.stopPropagation(); onRemove(idx); }}
                aria-label="Remove from queue"
                title="Remove"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
