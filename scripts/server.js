import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchVideos } from './fetchVideos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLAYLISTS_FILE = path.join(__dirname, '../src/data/playlists.json');

const app = express();
app.use(cors());
app.use(express.json());

// Active jobs tracker
const activeJobs = new Map();
let jobIdCounter = 0;

// GET /api/playlists — return current playlists.json structure
app.get('/api/playlists', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf-8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats — return video counts
app.get('/api/stats', (req, res) => {
  try {
    const videosFile = path.join(__dirname, '../src/data/videos.json');
    if (!fs.existsSync(videosFile)) return res.json({ total: 0, groups: {} });
    const data = JSON.parse(fs.readFileSync(videosFile, 'utf-8'));
    const stats = { lastUpdated: data.lastUpdated, total: 0, groups: {} };

    for (const [gName, group] of Object.entries(data.groups || {})) {
      stats.groups[gName] = { icon: group.icon, total: 0, categories: {} };
      for (const [cName, cat] of Object.entries(group.categories || {})) {
        stats.groups[gName].categories[cName] = {};
        for (const [pName, vids] of Object.entries(cat || {})) {
          stats.groups[gName].categories[cName][pName] = vids.length;
          stats.groups[gName].total += vids.length;
          stats.total += vids.length;
        }
      }
    }
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/fetch — trigger a fetch job
app.post('/api/fetch', (req, res) => {
  const { group, category, playlist } = req.body || {};
  const jobId = ++jobIdCounter;
  const logs = [];
  const log = (msg) => {
    logs.push(msg);
    console.log(msg);
  };

  activeJobs.set(jobId, { status: 'running', logs, startedAt: new Date().toISOString() });

  fetchVideos({ targetGroup: group || null, targetCategory: category || null, targetPlaylist: playlist || null, log })
    .then((summary) => {
      activeJobs.set(jobId, { status: 'done', logs, summary, finishedAt: new Date().toISOString() });
    })
    .catch((err) => {
      activeJobs.set(jobId, { status: 'error', logs, error: err.message, finishedAt: new Date().toISOString() });
    });

  res.json({ jobId, status: 'started' });
});

// GET /api/jobs/:id — check job status
app.get('/api/jobs/:id', (req, res) => {
  const job = activeJobs.get(parseInt(req.params.id));
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// GET /api/fav — get favorites
app.get('/api/fav', (req, res) => {
  try {
    const favFile = path.join(__dirname, '../src/data/fav.json');
    if (!fs.existsSync(favFile)) return res.json([]);
    const data = JSON.parse(fs.readFileSync(favFile, 'utf-8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/fav — toggle favorite
app.post('/api/fav', (req, res) => {
  try {
    const { videoId } = req.body;
    if (!videoId) return res.status(400).json({ error: 'videoId required' });
    
    const favFile = path.join(__dirname, '../src/data/fav.json');
    let data = [];
    if (fs.existsSync(favFile)) {
      data = JSON.parse(fs.readFileSync(favFile, 'utf-8'));
    }
    
    if (data.includes(videoId)) {
      data = data.filter(id => id !== videoId);
    } else {
      data.push(videoId);
    }
    
    fs.writeFileSync(favFile, JSON.stringify(data, null, 2), 'utf-8');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tags — create a tag or toggle a video on a tag
app.post('/api/tags', (req, res) => {
  try {
    const { tag, videoId } = req.body;
    if (!tag || typeof tag !== 'string') return res.status(400).json({ error: 'tag (string) required' });

    const tagsFile = path.join(__dirname, '../src/data/tags.json');
    let data = {};
    if (fs.existsSync(tagsFile)) {
      data = JSON.parse(fs.readFileSync(tagsFile, 'utf-8'));
    }

    const tagKey = tag.trim().toLowerCase();
    if (!tagKey) return res.status(400).json({ error: 'tag cannot be empty' });

    // Ensure tag exists
    if (!data[tagKey]) {
      data[tagKey] = [];
    }

    // If videoId provided, toggle it
    if (videoId) {
      if (data[tagKey].includes(videoId)) {
        data[tagKey] = data[tagKey].filter(id => id !== videoId);
      } else {
        data[tagKey].push(videoId);
      }
    }

    fs.writeFileSync(tagsFile, JSON.stringify(data, null, 2), 'utf-8');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tags/delete — delete a tag entirely
app.post('/api/tags/delete', (req, res) => {
  try {
    const { tag } = req.body;
    if (!tag || typeof tag !== 'string') return res.status(400).json({ error: 'tag (string) required' });

    const tagsFile = path.join(__dirname, '../src/data/tags.json');
    let data = {};
    if (fs.existsSync(tagsFile)) {
      data = JSON.parse(fs.readFileSync(tagsFile, 'utf-8'));
    }

    const tagKey = tag.trim().toLowerCase();
    delete data[tagKey];

    fs.writeFileSync(tagsFile, JSON.stringify(data, null, 2), 'utf-8');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ratings — set rating for a video
app.post('/api/ratings', (req, res) => {
  try {
    const { videoId, rating } = req.body;
    if (!videoId) return res.status(400).json({ error: 'videoId required' });

    const ratingsFile = path.join(__dirname, '../src/data/ratings.json');
    let data = {};
    if (fs.existsSync(ratingsFile)) {
      data = JSON.parse(fs.readFileSync(ratingsFile, 'utf-8'));
    }

    if (rating === null || rating === undefined || rating === 0) {
      delete data[videoId];
    } else {
      data[videoId] = rating;
    }

    fs.writeFileSync(ratingsFile, JSON.stringify(data, null, 2), 'utf-8');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 YouTube Library API running at http://localhost:${PORT}`);
  console.log(`   Endpoints:`);
  console.log(`   GET  /api/playlists  — View playlists config`);
  console.log(`   GET  /api/stats      — Video stats`);
  console.log(`   POST /api/fetch      — Start fetch job`);
  console.log(`   GET  /api/jobs/:id   — Check job status`);
  console.log(`   GET/POST /api/fav    — Manage favorites`);
  console.log(`   POST /api/tags       — Create/toggle tags`);
  console.log(`   POST /api/tags/delete — Delete a tag`);
  console.log(`   POST /api/ratings    — Set rating for a video\n`);
});
