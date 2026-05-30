import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import videosData from '../data/videos.json';

/* ── Helpers ───────────────────────────────────────────────── */

const NOISE = new Set(['full','video','song','official','hd','ultra','songs','music']);
const RES_RE = /(\[|\()?(?:8k|4k|1080p|720p|480p|60fps|hdr)(\]|\))?/gi;

function normalize(title) {
  let t = title.toLowerCase();
  t = t.replace(RES_RE, '');
  t = t.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '');
  t = t.split(/\s+/).filter(w => !NOISE.has(w)).join(' ').trim();
  return t;
}

function bigrams(str) {
  const words = str.split(/\s+/).filter(Boolean);
  const set = new Set();
  for (let i = 0; i < words.length - 1; i++) set.add(words[i] + ' ' + words[i + 1]);
  return set;
}

function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function flattenVideos() {
  const all = [];
  const musicGroup = videosData.groups?.Music;
  if (!musicGroup) return all;
  const cats = musicGroup.categories || {};
  for (const [cName, cObj] of Object.entries(cats)) {
    for (const [tName, videos] of Object.entries(cObj)) {
      if (!Array.isArray(videos)) continue;
      for (const v of videos) all.push({ ...v, group: 'Music', category: cName, type: tName });
    }
  }
  return all;
}

/* ── Component ─────────────────────────────────────────────── */

export default function DuplicatesPanel({ onVideoSelect, onClose }) {
  const [tab, setTab] = useState('exact');
  const [search, setSearch] = useState('');
  const [threshold, setThreshold] = useState(65);
  const [fuzzyDone, setFuzzyDone] = useState(false);

  const fuzzyRef = useRef([]);
  const allVideos = useMemo(() => flattenVideos(), []);

  /* ── Pass 1: Exact ID duplicates ────────────────────────── */
  const { exactDups, crossDups } = useMemo(() => {
    const map = new Map();
    for (const v of allVideos) {
      const id = v.youtubeLinkID;
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(v);
    }
    const exact = [];
    const cross = [];
    for (const [id, vids] of map) {
      if (vids.length < 2) continue;
      const locs = vids.map(v => ({ group: v.group, category: v.category, type: v.type }));
      const allSameGroupCat = locs.every(l => l.group === locs[0].group && l.category === locs[0].category);
      const diffType = allSameGroupCat && new Set(locs.map(l => l.type)).size > 1;
      if (diffType) {
        cross.push({ id, title: vids[0].title, thumbnail: `https://img.youtube.com/vi/${id}/mqdefault.jpg`, videos: vids, locations: locs });
      } else {
        exact.push({ id, title: vids[0].title, thumbnail: `https://img.youtube.com/vi/${id}/mqdefault.jpg`, videos: vids, locations: locs });
      }
    }
    return { exactDups: exact, crossDups: cross };
  }, [allVideos]);

  /* ── Pass 2: Fuzzy title duplicates (deferred) ──────────── */
  useEffect(() => {
    const normCache = new Map();
    const bigramCache = new Map();
    for (const v of allVideos) {
      const n = normalize(v.title || '');
      normCache.set(v, n);
      bigramCache.set(v, bigrams(n));
    }

    const timer = setTimeout(() => {
      const results = [];
      const seen = new Set();
      for (let i = 0; i < allVideos.length; i++) {
        for (let j = i + 1; j < allVideos.length; j++) {
          const a = allVideos[i], b = allVideos[j];
          if (a.youtubeLinkID === b.youtubeLinkID) continue;
          const key = [a.youtubeLinkID, b.youtubeLinkID].sort().join('|');
          if (seen.has(key)) continue;
          const na = normCache.get(a), nb = normCache.get(b);
          if (!na || !nb) continue;

          // Substring check
          if (na.length > 3 && nb.length > 3 && (na.includes(nb) || nb.includes(na))) {
            seen.add(key);
            results.push({ videoA: a, videoB: b, score: 0.85, reason: 'substring' });
            continue;
          }

          const ba = bigramCache.get(a), bb = bigramCache.get(b);
          if (ba.size === 0 || bb.size === 0) continue;
          const score = jaccard(ba, bb);
          if (score >= 0.55) {
            seen.add(key);
            results.push({ videoA: a, videoB: b, score, reason: 'bigram' });
          }
        }
      }
      fuzzyRef.current = results;
      setFuzzyDone(true);
    }, 0);

    return () => clearTimeout(timer);
  }, [allVideos]);

  /* ── Filtering ──────────────────────────────────────────── */
  const q = search.toLowerCase();
  const matchSearch = useCallback((v) => {
    if (!q) return true;
    return (v.title || '').toLowerCase().includes(q) ||
           (v.group || '').toLowerCase().includes(q) ||
           (v.category || '').toLowerCase().includes(q) ||
           (v.type || '').toLowerCase().includes(q);
  }, [q]);

  const filteredExact = useMemo(() => exactDups.filter(d => d.videos.some(matchSearch)), [exactDups, matchSearch]);
  const filteredCross = useMemo(() => crossDups.filter(d => d.videos.some(matchSearch)), [crossDups, matchSearch]);
  const filteredFuzzy = useMemo(() => {
    return fuzzyRef.current
      .filter(p => p.score * 100 >= threshold)
      .filter(p => matchSearch(p.videoA) || matchSearch(p.videoB));
  }, [fuzzyDone, threshold, matchSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const scoreBadgeColor = (pct) => pct >= 80 ? '#34c759' : pct >= 65 ? '#ff9500' : '#ff3b30';

  /* ── Breadcrumb ─────────────────────────────────────────── */
  const Crumb = ({ v }) => (
    <span className="dup-crumb">{v.group} › {v.category} › {v.type}</span>
  );

  const ResBadge = ({ v }) => v.resolution ? (
    <span className={`dup-res-badge dup-res-badge--${(v.resolution || '').toLowerCase().replace(/\s/g,'')}`}>{v.resolution}</span>
  ) : null;

  /* ── Video Card ─────────────────────────────────────────── */
  const Card = ({ v }) => (
    <div className="dup-card">
      <div className="dup-card__thumb-wrap">
        <img className="dup-card__thumb" src={`https://img.youtube.com/vi/${v.youtubeLinkID}/mqdefault.jpg`} alt="" loading="lazy" />
      </div>
      <div className="dup-card__info">
        <div className="dup-card__title">{v.title}</div>
        <div className="dup-card__meta">
          <Crumb v={v} />
          <ResBadge v={v} />
        </div>
      </div>
      <button className="dup-card__play" onClick={() => onVideoSelect(v)} title="Play">▶</button>
    </div>
  );

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="dup-panel">
      {/* Header */}
      <div className="dup-panel__header">
        <button className="dup-panel__back" onClick={onClose} title="Back to Scripts">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <h3 className="dup-panel__title">Duplicate Detector</h3>
      </div>

      {/* Search */}
      <div className="dup-panel__search-wrap">
        <svg className="dup-panel__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input className="dup-panel__search" placeholder="Filter by title or group…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Tabs */}
      <div className="dup-panel__tabs">
        {[
          { key: 'exact', label: 'Exact IDs', count: filteredExact.length },
          { key: 'fuzzy', label: 'Similar Titles', count: filteredFuzzy.length },
          { key: 'cross', label: 'Cross-playlist', count: filteredCross.length },
        ].map(t => (
          <button key={t.key}
            className={`filter-bar__tab ${tab === t.key ? 'filter-bar__tab--active' : ''}`}
            onClick={() => setTab(t.key)}>
            {t.label}
            <span className="filter-bar__count">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Tab 1 — Exact */}
      {tab === 'exact' && (
        <div className="dup-panel__body">
          <p className="dup-panel__summary">{filteredExact.length} video ID{filteredExact.length !== 1 ? 's' : ''} appear{filteredExact.length === 1 ? 's' : ''} in multiple playlists</p>
          {filteredExact.length === 0 && <div className="dup-panel__empty">No exact duplicates found 🎉</div>}
          {filteredExact.map(d => (
            <div key={d.id} className="dup-exact-card">
              <div className="dup-card__thumb-wrap">
                <img className="dup-card__thumb" src={d.thumbnail} alt="" loading="lazy" />
              </div>
              <div className="dup-exact-card__body">
                <div className="dup-card__title">{d.title}</div>
                <div className="dup-exact-card__pills">
                  {d.locations.map((l, i) => <Crumb key={i} v={l} />)}
                </div>
              </div>
              <button className="dup-card__play" onClick={() => onVideoSelect(d.videos[0])} title="Play">▶</button>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2 — Fuzzy */}
      {tab === 'fuzzy' && (
        <div className="dup-panel__body">
          {!fuzzyDone ? (
            <div className="dup-panel__spinner">
              <div className="dup-spinner" />
              <span>Analyzing titles…</span>
            </div>
          ) : (
            <>
              <div className="dup-panel__slider-row">
                <label>Threshold: <strong>{threshold}%</strong></label>
                <input type="range" min="55" max="95" value={threshold} onChange={e => setThreshold(+e.target.value)} className="dup-panel__slider" />
              </div>
              <p className="dup-panel__summary">{filteredFuzzy.length} suspiciously similar pair{filteredFuzzy.length !== 1 ? 's' : ''} found</p>
              {filteredFuzzy.length === 0 && <div className="dup-panel__empty">No similar titles at this threshold 👍</div>}
              {filteredFuzzy.map((p, i) => {
                const pct = Math.round(p.score * 100);
                return (
                  <div key={i} className="dup-pair">
                    <div className="dup-pair__grid">
                      <Card v={p.videoA} />
                      <div className="dup-pair__vs">
                        <span className="dup-pair__vs-pill">VS</span>
                        <span className="dup-pair__score" style={{ background: scoreBadgeColor(pct) }}>{pct}%</span>
                        <span className="dup-pair__reason">{p.reason === 'substring' ? 'Title contains other' : 'High word overlap'}</span>
                      </div>
                      <Card v={p.videoB} />
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Tab 3 — Cross-playlist */}
      {tab === 'cross' && (
        <div className="dup-panel__body">
          <p className="dup-panel__summary">{filteredCross.length} cross-playlist duplicate{filteredCross.length !== 1 ? 's' : ''}</p>
          {filteredCross.length === 0 && <div className="dup-panel__empty">No cross-playlist duplicates 🎉</div>}
          {filteredCross.map(d => (
            <div key={d.id} className="dup-exact-card">
              <div className="dup-card__thumb-wrap">
                <img className="dup-card__thumb" src={d.thumbnail} alt="" loading="lazy" />
              </div>
              <div className="dup-exact-card__body">
                <div className="dup-card__title">{d.title}</div>
                <div className="dup-exact-card__pills">
                  {d.locations.map((l, i) => <Crumb key={i} v={l} />)}
                </div>
              </div>
              <button className="dup-card__play" onClick={() => onVideoSelect(d.videos[0])} title="Play">▶</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
