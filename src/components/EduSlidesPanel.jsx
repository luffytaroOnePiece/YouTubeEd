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
  const [pdfUrl, setPdfUrl] = useState(null);
  const [htmlUrl, setHtmlUrl] = useState(null);
  const [activeTab, setActiveTab] = useState(null); // 'html' or 'pdf'
  const [error, setError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const videoId = video?.youtubeLinkID;

  // Probe for slides.pdf and index.html on mount or videoId change
  useEffect(() => {
    if (!videoId) return;

    setLoading(true);
    setError(false);
    setPdfUrl(null);
    setHtmlUrl(null);
    setActiveTab(null);
    setFullscreen(false);

    const folders = getFolderNames(videoId);
    let cancelled = false;

    // Helper to probe a specific file across folders in order
    const probeFile = (fileName) => {
      let idx = 0;
      return new Promise((resolve) => {
        const tryNext = () => {
          if (cancelled) {
            resolve(null);
            return;
          }
          if (idx >= folders.length) {
            resolve(null);
            return;
          }

          const folder = folders[idx];
          const url = `https://raw.githubusercontent.com/luffytaroOnePiece/EduData/main/YT/${folder}/${fileName}`;

          fetch(url, { method: 'HEAD', mode: 'cors' })
            .then((res) => {
              if (cancelled) {
                resolve(null);
                return;
              }
              if (res.ok) {
                resolve(url);
              } else {
                idx++;
                tryNext();
              }
            })
            .catch(() => {
              if (cancelled) {
                resolve(null);
                return;
              }
              idx++;
              tryNext();
            });
        };
        tryNext();
      });
    };

    // Run probes in parallel for index.html and slides.pdf
    Promise.all([
      probeFile('index.html'),
      probeFile('slides.pdf')
    ]).then(([foundHtmlUrl, foundPdfUrl]) => {
      if (cancelled) return;

      setLoading(false);

      if (foundHtmlUrl || foundPdfUrl) {
        setHtmlUrl(foundHtmlUrl);
        setPdfUrl(foundPdfUrl);

        // Show PDF slides first in the sidebar,
        // letting the user toggle to the HTML presentation at will.
        if (foundPdfUrl) {
          setActiveTab('pdf');
        } else {
          setActiveTab('html');
        }
      } else {
        setError(true);
      }
    });

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

  // PDF Viewer via Google Docs Viewer
  const viewerUrl = pdfUrl
    ? `https://docs.google.com/gview?url=${encodeURIComponent(pdfUrl)}&embedded=true`
    : null;

  // Interactive HTML Presentation URL via raw.githack.com (so styles/scripts work perfectly)
  const iframeHtmlUrl = htmlUrl
    ? htmlUrl.replace('raw.githubusercontent.com', 'raw.githack.com')
    : null;

  // Current active resource URL for fullscreen and sidebar
  const currentIframeUrl = activeTab === 'html' ? iframeHtmlUrl : viewerUrl;

  const githubUrl = (activeTab === 'html' ? htmlUrl : pdfUrl)
    ? (activeTab === 'html' ? htmlUrl : pdfUrl).replace('raw.githubusercontent.com', 'github.com').replace('/main/', '/blob/main/')
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
          <h3 className="notes-empty-title">Slides & Presentations Unavailable</h3>
          <p className="notes-empty-text">
            There are no lecture slides or HTML presentations uploaded for video <code>{videoId}</code> yet.
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
          {htmlUrl && (
            <button
              className="notes-action-btn slides-action-btn--fullscreen"
              onClick={() => { setActiveTab('html'); setFullscreen(true); }}
            >
              Code
            </button>
          )}
          {pdfUrl && (
            <a
              href={pdfUrl}
              download
              className="notes-action-btn slides-action-btn--download"
            >
              Download PDF
            </a>
          )}
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

        {/* Two Switcher Buttons in Sidebar (only shown if both HTML and PDF are available) */}
        {htmlUrl && pdfUrl && (
          <div className="slides-two-buttons-container">
            <button
              className={`slides-switch-btn ${activeTab === 'pdf' ? 'slides-switch-btn--active' : ''}`}
              onClick={() => setActiveTab('pdf')}
            >
              <span className="slides-switch-btn__icon"></span>
              <span className="slides-switch-btn__text">Slides</span>
            </button>
            <button
              className={`slides-switch-btn ${activeTab === 'html' ? 'slides-switch-btn--active' : ''}`}
              onClick={() => {
                setActiveTab('html');
                setFullscreen(true); // Open in full screen view as requested
              }}
            >
              <span className="slides-switch-btn__icon"></span>
              <span className="slides-switch-btn__text">Code (Fullscreen)</span>
            </button>
          </div>
        )}

        {/* Sidebar Main Content */}
        {pdfUrl && activeTab !== 'html' ? (
          /* Render the PDF viewer in the sidebar */
          <div className="slides-viewer-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="slides-viewer-badge">Lecture Slides (PDF)</div>
            <iframe
              src={viewerUrl}
              className="slides-viewer-iframe"
              title="Lecture Slides PDF"
              frameBorder="0"
              allowFullScreen
              style={{ flex: 1 }}
            />
          </div>
        ) : htmlUrl && (activeTab === 'html' || !pdfUrl) ? (
          /* Render banner/iframe for HTML. User wants it in full screen only */
          <div className="slides-panel--empty" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="notes-empty-card" style={{ margin: '1rem', textAlign: 'center' }}>
              <div className="notes-empty-icon"></div>
              <h3 className="notes-empty-title">Code Presentation</h3>
              <p className="notes-empty-text" style={{ marginBottom: '1rem' }}>
                Interactive code presentation is best viewed in full screen.
              </p>
              <button
                className="notes-empty-btn slides-empty-btn"
                onClick={() => { setActiveTab('html'); setFullscreen(true); }}
              >
                Open Code in Fullscreen ⛶
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Fullscreen PDF/HTML Reader Overlay ── */}
      {fullscreen && (
        <div className="slides-fullscreen-overlay" onClick={() => setFullscreen(false)}>
          {/* Toolbar */}
          <div className="slides-fullscreen-toolbar" onClick={(e) => e.stopPropagation()}>
            <div className="notes-reader-toolbar__left">
              <span className="notes-reader-toolbar__title">
                {video.title} — {activeTab === 'html' ? 'Interactive Presentation (Code)' : 'Slides PDF'}
              </span>
            </div>
            <div className="notes-reader-toolbar__right">
              {/* Fullscreen Two Switcher Buttons inside toolbar */}
              {htmlUrl && pdfUrl && (
                <div className="slides-fullscreen-buttons">
                  <button
                    className={`slides-fullscreen-btn ${activeTab === 'pdf' ? 'slides-fullscreen-btn--active' : ''}`}
                    onClick={() => setActiveTab('pdf')}
                  >
                    Slides
                  </button>
                  <button
                    className={`slides-fullscreen-btn ${activeTab === 'html' ? 'slides-fullscreen-btn--active' : ''}`}
                    onClick={() => setActiveTab('html')}
                  >
                    Code
                  </button>
                </div>
              )}
              {activeTab === 'pdf' && pdfUrl && (
                <a
                  href={pdfUrl}
                  download
                  className="notes-reader-toolbar__btn"
                  onClick={(e) => e.stopPropagation()}
                >
                  ⬇ Download PDF
                </a>
              )}
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

          {/* Full-size Content Frame */}
          <div className="slides-fullscreen-content" onClick={(e) => e.stopPropagation()}>
            <iframe
              src={currentIframeUrl}
              className="slides-fullscreen-iframe"
              title="Lecture Resource Fullscreen"
              frameBorder="0"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </>
  );
}
