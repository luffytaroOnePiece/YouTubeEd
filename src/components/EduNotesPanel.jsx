import React, { useState, useEffect, useRef, useCallback } from 'react';

// Resolves folders to try for a given videoId (handling cases like Tq1fif3rcnQ -> q1fif3rcnQ)
const getFolderNames = (videoId) => {
  const folders = [videoId];
  // If video ID starts with 'T', also try stripping it
  if (videoId.startsWith('T')) {
    folders.push(videoId.slice(1));
  }
  // Try lowercase variations just in case
  folders.push(videoId.toLowerCase());
  if (videoId.startsWith('T')) {
    folders.push(videoId.slice(1).toLowerCase());
  }
  return Array.from(new Set(folders));
};

export default function EduNotesPanel({ video }) {
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState([]);
  const [imageUrl, setImageUrl] = useState(null);
  const [notesUrl, setNotesUrl] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [error, setError] = useState(false);

  // Reader overlay state
  const [readerOpen, setReaderOpen] = useState(false);

  // Lightbox zoom/pan states
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const videoId = video?.youtubeLinkID;

  // Dynamically fetch notes on mount or videoId change
  useEffect(() => {
    if (!videoId) return;

    setLoading(true);
    setError(false);
    setImageError(false);
    setNotes([]);
    setImageUrl(null);
    setNotesUrl(null);
    setReaderOpen(false);

    const folders = getFolderNames(videoId);
    const files = ['notes.md', 'input.md', 'README.md'];
    
    // Create matrix of configurations to attempt sequentially
    const attempts = [];
    folders.forEach(folder => {
      files.forEach(file => {
        attempts.push({
          folder,
          file,
          notesUrl: `https://raw.githubusercontent.com/luffytaroOnePiece/EduData/main/YT/${folder}/${file}`,
          imageUrl: `https://raw.githubusercontent.com/luffytaroOnePiece/EduData/main/YT/${folder}/1.png`
        });
      });
    });

    let currentAttemptIdx = 0;

    const tryFetch = () => {
      if (currentAttemptIdx >= attempts.length) {
        setLoading(false);
        setError(true);
        return;
      }

      const attempt = attempts[currentAttemptIdx];
      
      fetch(attempt.notesUrl)
        .then(res => {
          if (!res.ok) throw new Error('Not found');
          return res.text();
        })
        .then(text => {
          // Success! Setup details
          setNotesUrl(attempt.notesUrl);
          setImageUrl(attempt.imageUrl);
          setNotes(parseMarkdown(text));
          setLoading(false);
        })
        .catch(() => {
          // Try next combination
          currentAttemptIdx++;
          tryFetch();
        });
    };

    tryFetch();
  }, [videoId]);

  // Markdown parsing engine
  const parseMarkdown = (mdText) => {
    if (!mdText) return [];
    
    const lines = mdText.split('\n');
    const parsedBlocks = [];
    
    let inList = false;
    let listItems = [];
    let inCodeBlock = false;
    let codeContent = [];
    let codeLang = '';

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();

      // Handle Code Blocks
      if (trimmed.startsWith('```')) {
        if (inCodeBlock) {
          parsedBlocks.push({ type: 'code', lang: codeLang, text: codeContent.join('\n') });
          inCodeBlock = false;
          codeContent = [];
        } else {
          inCodeBlock = true;
          codeLang = trimmed.substring(3).trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent.push(rawLine);
        continue;
      }

      // Handle lists
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        inList = true;
        listItems.push(trimmed.substring(2));
        continue;
      } else if (inList && !trimmed.startsWith('- ') && !trimmed.startsWith('* ') && trimmed !== '') {
        parsedBlocks.push({ type: 'list', items: listItems });
        inList = false;
        listItems = [];
      }

      if (trimmed === '') {
        continue;
      }

      // Headers (1 to 4 levels)
      if (trimmed.startsWith('# ')) {
        parsedBlocks.push({ type: 'h1', text: trimmed.substring(2) });
      } else if (trimmed.startsWith('## ')) {
        parsedBlocks.push({ type: 'h2', text: trimmed.substring(3) });
      } else if (trimmed.startsWith('### ')) {
        parsedBlocks.push({ type: 'h3', text: trimmed.substring(4) });
      } else if (trimmed.startsWith('#### ')) {
        parsedBlocks.push({ type: 'h4', text: trimmed.substring(5) });
      } 
      // Match numerical structural titles e.g. "1.0 Introduction: The Challenge..."
      else if (/^\d+(\.\d+)*\s+/.test(trimmed)) {
        parsedBlocks.push({ type: 'h2', text: trimmed, isStructural: true });
      }
      // GitHub style alerts blockquote
      else if (trimmed.startsWith('> [!NOTE]') || trimmed.startsWith('> [!IMPORTANT]') || trimmed.startsWith('> [!TIP]')) {
        const type = trimmed.includes('IMPORTANT') ? 'important' : trimmed.includes('TIP') ? 'tip' : 'note';
        parsedBlocks.push({ type: 'alert', alertType: type, text: '' });
      }
      else if (trimmed.startsWith('>') && parsedBlocks.length > 0 && parsedBlocks[parsedBlocks.length - 1].type === 'alert') {
        const prevBlock = parsedBlocks[parsedBlocks.length - 1];
        prevBlock.text = (prevBlock.text ? prevBlock.text + ' ' : '') + trimmed.substring(1).trim();
      }
      // General Paragraph
      else {
        parsedBlocks.push({ type: 'p', text: trimmed });
      }
    }

    // Capture trailing items
    if (inList) {
      parsedBlocks.push({ type: 'list', items: listItems });
    }

    return parsedBlocks;
  };

  // Helper to parse bold, links, and code inline formatting
  const renderInlineStyles = (text) => {
    if (!text) return '';
    
    // Ignore YouTube/Mindmap image links inside markdown
    if (text.startsWith('[![YouTube') || text.startsWith('![Mind') || text.includes('MindMaps/')) {
      return null;
    }

    const parts = [];
    let currentIndex = 0;
    const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index;
      const matchStr = match[0];

      if (matchIndex > currentIndex) {
        parts.push(text.substring(currentIndex, matchIndex));
      }

      if (matchStr.startsWith('**') && matchStr.endsWith('**')) {
        parts.push(<strong key={matchIndex} className="notes-bold">{matchStr.slice(2, -2)}</strong>);
      } else if (matchStr.startsWith('`') && matchStr.endsWith('`')) {
        parts.push(<code key={matchIndex} className="notes-code-inline">{matchStr.slice(1, -1)}</code>);
      } else if (matchStr.startsWith('[') && matchStr.includes('](')) {
        const closeBracket = matchStr.indexOf(']');
        const label = matchStr.substring(1, closeBracket);
        const url = matchStr.substring(closeBracket + 2, matchStr.length - 1);
        parts.push(
          <a key={matchIndex} href={url} target="_blank" rel="noopener noreferrer" className="notes-anchor">
            {label}
          </a>
        );
      }

      currentIndex = regex.lastIndex;
    }

    if (currentIndex < text.length) {
      parts.push(text.substring(currentIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  // Render all note blocks
  const renderBlocks = (blocks) => {
    return blocks.map((block, idx) => {
      const content = renderInlineStyles(block.text);
      if (content === null) return null;

      switch (block.type) {
        case 'h1':
          return <h1 key={idx} className="notes-h1">{content}</h1>;
        case 'h2':
          return (
            <h2 key={idx} className={`notes-h2 ${block.isStructural ? 'notes-h2--structural' : ''}`}>
              {content}
            </h2>
          );
        case 'h3':
          return <h3 key={idx} className="notes-h3">{content}</h3>;
        case 'h4':
          return <h4 key={idx} className="notes-h4">{content}</h4>;
        case 'p':
          return <p key={idx} className="notes-p">{content}</p>;
        case 'list':
          return (
            <ul key={idx} className="notes-ul">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="notes-li">{renderInlineStyles(item)}</li>
              ))}
            </ul>
          );
        case 'alert':
          return (
            <div key={idx} className={`notes-alert notes-alert--${block.alertType}`}>
              <div className="notes-alert-icon">
                {block.alertType === 'important' ? '⚠️' : block.alertType === 'tip' ? '💡' : 'ℹ️'}
              </div>
              <div className="notes-alert-content">
                {renderInlineStyles(block.text)}
              </div>
            </div>
          );
        case 'code':
          return (
            <div key={idx} className="notes-code-block-wrapper">
              <div className="notes-code-header">
                <span>{block.lang || 'code'}</span>
              </div>
              <pre className="notes-code-pre">
                <code className="notes-code-text">{block.text}</code>
              </pre>
            </div>
          );
        default:
          return null;
      }
    });
  };

  // Lightbox Zoom / Drag Handlers
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.75));
  const handleResetZoom = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Keyboard: ESC closes lightbox first, then reader
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (lightboxOpen) {
          e.stopPropagation();
          setLightboxOpen(false);
        } else if (readerOpen) {
          e.stopPropagation();
          setReaderOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [lightboxOpen, readerOpen]);

  // Lock body scroll when reader is open
  useEffect(() => {
    if (readerOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      if (readerOpen) {
        document.body.style.overflow = '';
      }
    };
  }, [readerOpen]);

  const githubSourceUrl = notesUrl
    ? notesUrl.replace('raw.githubusercontent.com', 'github.com').replace('/main/', '/blob/main/')
    : null;

  // Shimmer Loader for Premium Aesthetic
  if (loading) {
    return (
      <div className="notes-panel notes-panel--loading">
        <div className="notes-shimmer notes-shimmer--image" />
        <div className="notes-shimmer notes-shimmer--title" />
        <div className="notes-shimmer notes-shimmer--text" />
        <div className="notes-shimmer notes-shimmer--text" />
        <div className="notes-shimmer notes-shimmer--text" />
      </div>
    );
  }

  // Beautiful, Actionable Empty State
  if (error) {
    const editUrl = `https://github.com/luffytaroOnePiece/EduData/new/main/YT`;
    return (
      <div className="notes-panel notes-panel--empty">
        <div className="notes-empty-card">
          <div className="notes-empty-icon">🧠</div>
          <h3 className="notes-empty-title">Study Notes Unavailable</h3>
          <p className="notes-empty-text">
            There are currently no research notes or mind maps uploaded for video <code>{videoId}</code> yet.
          </p>
          <a
            href={editUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="notes-empty-btn"
          >
            ✍ Create Notes on GitHub
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Sidebar Panel ── */}
      <div className="notes-panel">
        {/* Action bar */}
        <div className="notes-header-actions">
          <button className="notes-action-btn notes-action-btn--reader" onClick={() => setReaderOpen(true)}>
            📖 Open Reader
          </button>
          {githubSourceUrl && (
            <a
              href={githubSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="notes-action-btn notes-action-btn--github"
            >
              GitHub ↗
            </a>
          )}
        </div>

        {/* Mind Map Card */}
        {imageUrl && !imageError && (
          <div className="notes-image-container">
            <div className="notes-image-card" onClick={() => setLightboxOpen(true)}>
              <div className="notes-image-badge">📊 Mind Map</div>
              <img
                src={imageUrl}
                alt="Study Mind Map"
                className="notes-mind-map"
                onError={() => setImageError(true)}
              />
              <div className="notes-image-overlay">
                <span>🔍 Click to expand</span>
              </div>
            </div>
          </div>
        )}

        {/* Notes Body (sidebar preview) */}
        <div className="notes-body">
          {renderBlocks(notes)}
        </div>
      </div>

      {/* ── Reader Overlay (Apple Books style) ── */}
      {readerOpen && (
        <div className="notes-reader-overlay" onClick={() => setReaderOpen(false)}>
          {/* Frosted Toolbar */}
          <div className="notes-reader-toolbar" onClick={(e) => e.stopPropagation()}>
            <div className="notes-reader-toolbar__left">
              <span className="notes-reader-toolbar__icon">📖</span>
              <span className="notes-reader-toolbar__title">{video.title}</span>
            </div>
            <div className="notes-reader-toolbar__right">
              {githubSourceUrl && (
                <a
                  href={githubSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="notes-reader-toolbar__btn notes-reader-toolbar__btn--github"
                >
                  View on GitHub ↗
                </a>
              )}
              <button
                className="notes-reader-toolbar__close"
                onClick={() => setReaderOpen(false)}
                aria-label="Close reader"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="notes-reader-scroll" onClick={(e) => e.stopPropagation()}>
            <article className="notes-reader-article">
              {/* Mind Map in reader */}
              {imageUrl && !imageError && (
                <div className="notes-reader-mindmap" onClick={() => setLightboxOpen(true)}>
                  <div className="notes-image-badge">📊 Interactive Mind Map</div>
                  <img
                    src={imageUrl}
                    alt="Study Mind Map"
                    className="notes-reader-mindmap__img"
                    onError={() => setImageError(true)}
                  />
                  <div className="notes-image-overlay">
                    <span>🔍 Click to zoom & pan</span>
                  </div>
                </div>
              )}

              {/* Full notes content */}
              <div className="notes-body notes-body--reader">
                {renderBlocks(notes)}
              </div>
            </article>
          </div>
        </div>
      )}

      {/* ── Fullscreen Lightbox (shared between sidebar & reader) ── */}
      {lightboxOpen && imageUrl && (
        <div
          className="notes-lightbox"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="notes-lightbox-header" onClick={e => e.stopPropagation()}>
            <span className="notes-lightbox-title">{video.title} — System Mind Map</span>
            <button className="notes-lightbox-close" onClick={() => setLightboxOpen(false)}>✕</button>
          </div>

          <div
            className={`notes-lightbox-content ${isDragging ? 'notes-lightbox-content--dragging' : ''}`}
            onClick={e => e.stopPropagation()}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              src={imageUrl}
              alt="System Mind Map Fullscreen"
              className="notes-lightbox-img"
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                cursor: isDragging ? 'grabbing' : 'grab'
              }}
              onMouseDown={handleMouseDown}
            />
          </div>

          {/* Lightbox Action Controls Bar */}
          <div className="notes-lightbox-controls" onClick={e => e.stopPropagation()}>
            <button onClick={handleZoomOut} title="Zoom Out" className="notes-lightbox-btn">−</button>
            <span className="notes-lightbox-zoom-val">{Math.round(zoom * 100)}%</span>
            <button onClick={handleZoomIn} title="Zoom In" className="notes-lightbox-btn">+</button>
            <button onClick={handleResetZoom} title="Reset" className="notes-lightbox-btn notes-lightbox-btn--reset">↺</button>
            <div className="notes-lightbox-tip">💡 Drag image to pan & explore system diagram</div>
          </div>
        </div>
      )}
    </>
  );
}
