import React from 'react';
import VideoCard from './VideoCard';

export default function VideoGrid({ videos, onVideoSelect, gridColumns, isLocal, favorites, onToggleFav, tags, onToggleTag, ratings, onSetRating }) {
  if (!videos || videos.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">🎬</div>
        <h2 className="empty-state__title">No videos found</h2>
        <p className="empty-state__subtitle">
          Try adjusting your search or selecting a different category.
        </p>
      </div>
    );
  }

  const gridStyle = gridColumns
    ? { gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }
    : {};

  return (
    <div className="video-grid" style={gridStyle}>
      {videos.map((video, index) => (
        <VideoCard
          key={video.youtubeLinkID}
          video={video}
          onClick={onVideoSelect}
          index={index}
          isLocal={isLocal}
          isFav={favorites?.includes(video.youtubeLinkID)}
          onToggleFav={onToggleFav}
          tags={tags}
          onToggleTag={onToggleTag}
          rating={ratings?.[video.youtubeLinkID] || 0}
          onSetRating={onSetRating}
        />
      ))}
    </div>
  );
}
