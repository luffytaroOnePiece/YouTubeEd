import React, { useState, useEffect } from 'react';

// Resolves folders to try for a given videoId (same logic as EduNotesPanel)
const getFolderNames = (videoId) => {
  const folders = [videoId];
  if (videoId.startsWith('T')) {
    folders.push(videoId.slice(1));
  }
  folders.push(videoId.toLowerCase());
  if (videoId.startsWith('T')) {
    folders.push(videoId.slice(1).toLowerCase());
  }
  return Array.from(new Set(folders));
};

export default function EduSlidesPanel({ video }) {
  const [loading, setLoading] = useState(true);
  const [slidesUrl, setSlidesUrl] = useState(null);
  const [error, setError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const videoId = video?.youtubeLinkID;

  // Probe for slides.pdf on mount or videoId change
  useEffect(() => {
    if (!videoId) return;

    setLoading(true);
    setError(false);
    setSlidesUrl(null);
    setFullscreen(false);

    const folders = getFolderNames(videoId);
    const urls = folders.map(
      (f) => `https://raw.githubusercontent.com/luffytaroOnePiece/EduData/main/YT/${f}/slides.pdf`
    );

    let currentIdx = 0;
    let cancelled = false;

    const tryNext = () => {
      if (cancelled) return;
      if (currentIdx >= urls.length) {
        setLoading(false);
        setError(true);
        return;
      }

      const url = urls[currentIdx];

      fetch(url, { method: 'HEAD', mode: 'cors' })
        .then((res) => {
          if (cancelled) return;
          if (res.ok) {
            setSlidesUrl(url);
            setLoading(false);
          } else {
            currentIdx++;
            tryNext();
          }
        })
        .catch(() => {
          if (cancelled) return;
          currentIdx++;
          tryNext();
        });
    };

    tryNext();

    return () => { cancelled = true; };
  }, [videoId]);

  // ESC to close fullscreen
  useEffect(() => {
    if (!fullscreen) return;

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [fullscreen]);

  // Lock body scroll when fullscreen
  useEffect(() => {
    if (fullscreen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      if (fullscreen) document.body.style.overflow = '';
    };
  }, [fullscreen]);

  // Build a Google Docs viewer URL for rendering the PDF (works for raw GitHub PDFs)
  const viewerUrl = slidesUrl
    ? `https://docs.google.com/gview?url=${encodeURIComponent(slidesUrl)}&embedded=true`
    : null;

  const githubUrl = slidesUrl
    ? slidesUrl.replace('raw.githubusercontent.com', 'github.com').replace('/main/', '/blob/main/')
    : null;

  // Shimmer loading state
  if (loading) {
    return (
      <div className="slides-panel slides-panel--loading">
        <div className="notes-shimmer notes-shimmer--title" />
        <div className="notes-shimmer notes-shimmer--image" />
        <div className="notes-shimmer notes-shimmer--text" />
      </div>
    );
  }

  // Empty state
  if (error) {
    const createUrl = `https://github.com/luffytaroOnePiece/EduData/upload/main/YT`;
    return (
      <div className="slides-panel slides-panel--empty">
        <div className="notes-empty-card">
          <div className="notes-empty-icon">📄</div>
          <h3 className="notes-empty-title">Slides Unavailable</h3>
          <p className="notes-empty-text">
            There are no lecture slides uploaded for video <code>{videoId}</code> yet.
          </p>
          <a
            href={createUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="notes-empty-btn slides-empty-btn"
          >
            📤 Upload Slides on GitHub
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Sidebar Panel ── */}
      <div className="slides-panel">
        {/* Action bar */}
        <div className="notes-header-actions">
          <button
            className="notes-action-btn slides-action-btn--fullscreen"
            onClick={() => setFullscreen(true)}
          >
            Fullscreen
          </button>
          <a
            href={slidesUrl}
            download
            className="notes-action-btn slides-action-btn--download"
          >
            Download
          </a>
          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="notes-action-btn notes-action-btn--github"
            >
              GitHub ↗
            </a>
          )}
        </div>

        {/* Inline PDF Viewer */}
        <div className="slides-viewer-wrapper">
          <div className="slides-viewer-badge">📄 Lecture Slides</div>
          <iframe
            src={viewerUrl}
            className="slides-viewer-iframe"
            title="Lecture Slides"
            frameBorder="0"
            allowFullScreen
          />
        </div>
      </div>

      {/* ── Fullscreen PDF Reader Overlay ── */}
      {fullscreen && (
        <div className="slides-fullscreen-overlay" onClick={() => setFullscreen(false)}>
          {/* Toolbar */}
          <div className="slides-fullscreen-toolbar" onClick={(e) => e.stopPropagation()}>
            <div className="notes-reader-toolbar__left">
              <span className="notes-reader-toolbar__icon">📄</span>
              <span className="notes-reader-toolbar__title">{video.title} — Slides</span>
            </div>
            <div className="notes-reader-toolbar__right">
              <a
                href={slidesUrl}
                download
                className="notes-reader-toolbar__btn"
                onClick={(e) => e.stopPropagation()}
              >
                ⬇ Download PDF
              </a>
              {githubUrl && (
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="notes-reader-toolbar__btn notes-reader-toolbar__btn--github"
                  onClick={(e) => e.stopPropagation()}
                >
                  View on GitHub ↗
                </a>
              )}
              <button
                className="notes-reader-toolbar__close"
                onClick={() => setFullscreen(false)}
                aria-label="Close slides viewer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Full-size PDF */}
          <div className="slides-fullscreen-content" onClick={(e) => e.stopPropagation()}>
            <iframe
              src={viewerUrl}
              className="slides-fullscreen-iframe"
              title="Lecture Slides Fullscreen"
              frameBorder="0"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </>
  );
}
