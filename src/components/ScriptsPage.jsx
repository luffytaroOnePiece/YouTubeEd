import React, { useState, useEffect, useCallback, useRef } from 'react';
import DuplicatesPanel from './DuplicatesPanel';

const API_BASE = 'http://localhost:3001/api';

export default function ScriptsPage({ onClose, onVideoSelect }) {
  const [stats, setStats] = useState(null);
  const [playlists, setPlaylists] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [jobLogs, setJobLogs] = useState([]);
  const [error, setError] = useState(null);
  const [serverOnline, setServerOnline] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const pollRef = useRef(null);
  const logsEndRef = useRef(null);

  // Check server status
  const checkServer = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setServerOnline(true);
        return true;
      }
    } catch { /* offline */ }
    setServerOnline(false);
    return false;
  }, []);

  // Load playlists config
  const loadPlaylists = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/playlists`);
      if (res.ok) setPlaylists(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    checkServer().then((online) => {
      if (online) loadPlaylists();
    });
    const interval = setInterval(checkServer, 5000);
    return () => clearInterval(interval);
  }, [checkServer, loadPlaylists]);

  // Scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [jobLogs]);

  // Poll active job
  const pollJob = useCallback(async (jobId) => {
    try {
      const res = await fetch(`${API_BASE}/jobs/${jobId}`);
      if (!res.ok) return;
      const job = await res.json();
      setJobLogs(job.logs || []);
      if (job.status === 'done' || job.status === 'error') {
        setActiveJob({ ...job, id: jobId });
        clearInterval(pollRef.current);
        pollRef.current = null;
        checkServer(); // refresh stats
      }
    } catch { /* ignore */ }
  }, [checkServer]);

  // Start a fetch job
  const startFetch = useCallback(async (group, category, playlist) => {
    setError(null);
    setJobLogs([]);
    try {
      const res = await fetch(`${API_BASE}/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group, category, playlist }),
      });
      const data = await res.json();
      setActiveJob({ id: data.jobId, status: 'running' });

      // Poll every 1s
      pollRef.current = setInterval(() => pollJob(data.jobId), 1000);
    } catch (err) {
      setError('Failed to start job. Is the API server running?');
    }
  }, [pollJob]);

  // Cleanup
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const isRunning = activeJob?.status === 'running';

  return (
    <div className="scripts-overlay">
      <div className={`scripts-modal${showDuplicates ? ' scripts-modal--wide' : ''}`}>
        {/* Header */}
        <div className="scripts-modal__header">
          <div className="scripts-modal__title-row">
            <h2 className="scripts-modal__title">Scripts</h2>
            <div className={`scripts-modal__status ${serverOnline ? 'scripts-modal__status--online' : ''}`}>
              <span className="scripts-modal__status-dot" />
              {serverOnline ? 'API Online' : 'API Offline'}
            </div>
            <button
              className={`scripts-modal__btn scripts-modal__btn--sm${showDuplicates ? ' scripts-modal__btn--active' : ''}`}
              onClick={() => setShowDuplicates(d => !d)}
            >
              🔍 Duplicates
            </button>
          </div>
          <button className="scripts-modal__close" onClick={onClose}>✕</button>
        </div>

        {/* Duplicates Panel or normal fetch UI */}
        {showDuplicates ? (
          <DuplicatesPanel onVideoSelect={(v) => { onVideoSelect?.(v); onClose(); }} onClose={() => setShowDuplicates(false)} />
        ) : (
          <>
            {/* Offline message */}
            {!serverOnline && (
              <div className="scripts-modal__offline">
                <p>API server is not running. Start it with:</p>
                <code>npm run api</code>
              </div>
            )}

            {/* Stats */}
            {serverOnline && stats && (
              <div className="scripts-modal__stats">
                <div className="scripts-modal__stat">
                  <span className="scripts-modal__stat-value">{stats.total}</span>
                  <span className="scripts-modal__stat-label">Total Videos</span>
                </div>
                <div className="scripts-modal__stat">
                  <span className="scripts-modal__stat-value">{Object.keys(stats.groups || {}).length}</span>
                  <span className="scripts-modal__stat-label">Groups</span>
                </div>
                {stats.lastUpdated && (
                  <div className="scripts-modal__stat">
                    <span className="scripts-modal__stat-value">{new Date(stats.lastUpdated).toLocaleDateString()}</span>
                    <span className="scripts-modal__stat-label">Last Updated</span>
                  </div>
                )}
              </div>
            )}

            {/* Fetch Buttons */}
            {serverOnline && (
              <div className="scripts-modal__actions">
                <h3 className="scripts-modal__section-title">Fetch Playlists</h3>

                {/* Full update */}
                <button
                  className="scripts-modal__btn scripts-modal__btn--primary"
                  onClick={() => startFetch()}
                  disabled={isRunning}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                  Fetch All (Full Update)
                </button>

                {/* Per-group buttons */}
                {playlists && Object.entries(playlists).map(([groupName, groupConfig]) => {
                  const cats = groupConfig.categories || {};
                  const catCount = Object.keys(cats).length;
                  if (catCount === 0) return null;

                  return (
                    <div key={groupName} className="scripts-modal__group">
                      <div className="scripts-modal__group-header">
                        <span>{groupConfig.icon} {groupName}</span>
                        <button
                          className="scripts-modal__btn scripts-modal__btn--sm"
                          onClick={() => startFetch(groupName)}
                          disabled={isRunning}
                        >
                          Fetch All {groupName}
                        </button>
                      </div>

                      {Object.entries(cats).map(([catName, catPlaylists]) => (
                        <div key={catName} className="scripts-modal__cat">
                          <span className="scripts-modal__cat-name">{catName}</span>
                          <div className="scripts-modal__cat-btns">
                            {Object.keys(catPlaylists || {}).map((plName) => (
                              <button
                                key={plName}
                                className="scripts-modal__btn scripts-modal__btn--xs"
                                onClick={() => startFetch(groupName, catName, plName)}
                                disabled={isRunning}
                              >
                                {plName}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Error */}
            {error && <div className="scripts-modal__error">{error}</div>}

            {/* Job Logs */}
            {activeJob && (
              <div className="scripts-modal__logs">
                <div className="scripts-modal__logs-header">
                  <span>
                    {isRunning ? '⏳ Running...' : activeJob.status === 'done' ? '✅ Complete' : '❌ Error'}
                  </span>
                </div>
                <div className="scripts-modal__logs-body">
                  {jobLogs.map((line, i) => (
                    <div key={i} className="scripts-modal__log-line">{line}</div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
