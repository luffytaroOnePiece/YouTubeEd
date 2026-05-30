import React, { useMemo } from 'react';

export default function RelatedPanel({ currentVideo, allVideos, onVideoSelect }) {
  const relatedVideos = useMemo(() => {
    if (!currentVideo || !allVideos) return [];

    const pool = allVideos.filter(v => v.youtubeLinkID !== currentVideo.youtubeLinkID && v.group === currentVideo.group);
    const currentMs = currentVideo.date ? new Date(currentVideo.date).getTime() : 0;

    // Prioritize same type (e.g. Romance, Mass) across ALL categories
    pool.sort((a, b) => {
      const aType = a.type === currentVideo.type ? 0 : 1;
      const bType = b.type === currentVideo.type ? 0 : 1;
      if (aType !== bType) return aType - bType;
      const aMs = a.date ? new Date(a.date).getTime() : 0;
      const bMs = b.date ? new Date(b.date).getTime() : 0;
      return Math.abs(aMs - currentMs) - Math.abs(bMs - currentMs);
    });

    return pool.slice(0, 12);
  }, [currentVideo, allVideos]);

  return (
    <div className="related-panel">
      <h3 className="related-panel__title">Related Videos</h3>
      <div className="related-panel__list">
        {relatedVideos.map(video => (
          <div 
            key={video.youtubeLinkID} 
            className="related-video-card"
            onClick={() => onVideoSelect(video)}
          >
            <div className="related-video-card__thumbnail">
              <img 
                src={`https://img.youtube.com/vi/${video.youtubeLinkID}/mqdefault.jpg`} 
                alt={video.title} 
                loading="lazy" 
              />
              {video.duration && (
                <span className="related-video-card__duration">{video.duration}</span>
              )}
            </div>
            <div className="related-video-card__info">
              <h4 className="related-video-card__title" title={video.title}>{video.title}</h4>
              <span className="related-video-card__type">{video.type}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
