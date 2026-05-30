import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import ytpl from 'ytpl';
import ytdl from 'ytdl-core';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLAYLISTS_FILE = path.join(__dirname, '../src/data/playlists.json');
const VIDEOS_FILE = path.join(__dirname, '../src/data/videos.json');

const DELAY_MS = 500;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function getResolutionLabel(formats) {
  if (!formats || !Array.isArray(formats)) return '';
  const heights = formats
    .filter(f => f.qualityLabel)
    .map(f => { const m = f.qualityLabel.match(/(\d+)p/); return m ? parseInt(m[1]) : 0; })
    .filter(h => h > 0);
  if (heights.length === 0) return '';
  const max = Math.max(...heights);
  if (max >= 4320) return '8K';
  if (max >= 2160) return '4K';
  if (max >= 1440) return '2K';
  if (max >= 1080) return '1080p';
  if (max >= 720) return '720p';
  if (max >= 480) return '480p';
  return `${max}p`;
}

/** Build a Set of all existing YouTube IDs from videos.json */
function buildVideoCache(existingGroups) {
  const cache = new Map();
  for (const [groupName, group] of Object.entries(existingGroups)) {
    for (const [catName, cat] of Object.entries(group.categories || {})) {
      for (const [plName, videos] of Object.entries(cat || {})) {
        for (const v of videos) {
          cache.set(v.youtubeLinkID, v);
        }
      }
    }
  }
  return cache;
}

/**
 * Fetch a playlist, using cache when possible.
 * @param {string} url - Playlist URL
 * @param {string} groupName
 * @param {string} categoryName
 * @param {string} playlistName
 * @param {Map} videoCache - Existing video data by ID
 * @param {function} log - Logging function (console.log or custom)
 */
export async function fetchPlaylist(idOrUrl, groupName, categoryName, playlistName, videoCache, log = console.log) {
  // Support both raw IDs and full URLs
  const playlistId = idOrUrl.includes('list=')
    ? idOrUrl.split('list=')[1]?.split('&')[0]
    : idOrUrl.trim();

  if (!playlistId) {
    log(`    ⚠️  Invalid playlist ID: ${idOrUrl}`);
    return [];
  }

  // Try yt-dlp first as the primary robust source
  let playlistItems = [];
  try {
    const url = `https://www.youtube.com/playlist?list=${playlistId}`;
    const raw = execSync(
      `yt-dlp --flat-playlist --dump-json --no-warnings "${url}"`,
      { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, timeout: 120000 }
    );
    playlistItems = raw.trim().split('\n').filter(Boolean).map(line => {
      const entry = JSON.parse(line);
      return {
        id: entry.id,
        title: entry.title || 'Untitled',
        durationSec: Math.round(entry.duration || 0),
      };
    });
  } catch (dlpErr) {
    log(`    ⚠️  yt-dlp failed (${dlpErr.message}), falling back to ytpl...`);
  }

  // Use ytpl to supplement any missing videos (multi-collaborator songs often skipped by flat-playlist)
  try {
    const playlist = await ytpl(playlistId, { limit: Infinity });
    const ytplItems = playlist.items.map(item => ({
      id: item.id,
      title: item.title,
      durationSec: item.durationSec || 0,
    }));
    
    // Merge results, giving yt-dlp priority for duplicates
    const existingIds = new Set(playlistItems.map(x => x.id));
    let addedCount = 0;
    
    // We iterate through ytpl items to retain original playlist order where possible 
    // by injecting them, but for simplicity we'll just push them here.
    for (const item of ytplItems) {
      if (!existingIds.has(item.id)) {
        playlistItems.push(item);
        addedCount++;
      }
    }
    
    if (addedCount > 0) {
      log(`    ➕ Recovered ${addedCount} missing videos via ytpl!`);
    }
  } catch (ytplErr) {
    if (playlistItems.length === 0) {
      throw new Error(`Both yt-dlp and ytpl failed to fetch any items. Ytpl err: ${ytplErr.message}`);
    } else {
      log(`    ⚠️  ytpl supplement check skipped/failed: ${ytplErr.message}`);
    }
  }

  // 3rd level fallback: raw HTML regex scan for any remaining skipped IDs
  try {
    const rawHtml = execSync(`curl -sL "https://www.youtube.com/playlist?list=${playlistId}"`, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
    const idMatches = rawHtml.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g);
    const existingIds = new Set(playlistItems.map(x => x.id));
    let rawAdded = 0;
    
    for (const m of idMatches) {
      const vidId = m[1];
      if (!existingIds.has(vidId)) {
        playlistItems.push({ id: vidId, title: 'Fetching title...', durationSec: 0 });
        existingIds.add(vidId);
        rawAdded++;
      }
    }
    if (rawAdded > 0) log(`    ➕ Recovered ${rawAdded} missing videos via raw HTML scan!`);
  } catch (rawErr) {
    // Silently continue if curl fails
  }

  const total = playlistItems.length;
  let cached = 0;
  let fetched = 0;

  // Re-calculate since elements might have been added
  log(`    Found ${total} total videos. Processing...\n`);

  const videos = [];

  for (let i = 0; i < total; i++) {
    const item = playlistItems[i];
    const progress = `    [${i + 1}/${total}]`;

    // Check cache first
    const existing = videoCache.get(item.id);
    if (existing && existing.date) {
      // Re-use cached data, just update group/category/type in case it moved
      videos.push({
        ...existing,
        group: groupName,
        category: categoryName,
        type: playlistName,
      });
      cached++;
      log(`${progress} ⚡ CACHED: ${item.title.substring(0, 50)}...`);
      continue;
    }

    // Fetch fresh data
    let publishDate = '';
    let resolution = '';
    let viewCount = 0;
    try {
      const info = await ytdl.getBasicInfo(item.id);
      publishDate = info.videoDetails.publishDate || '';
      resolution = getResolutionLabel(info.formats || []);
      viewCount = parseInt(info.videoDetails.viewCount) || 0;
      
      if (item.title === 'Fetching title...' || !item.title) {
        item.title = info.videoDetails.title || 'Unknown Title';
      }
      if (!item.durationSec && info.videoDetails.lengthSeconds) {
        item.durationSec = parseInt(info.videoDetails.lengthSeconds) || 0;
      }
    } catch (e) {
      // Fall back
    }

    videos.push({
      youtubeLinkID: item.id,
      title: item.title,
      thumbnail: `https://img.youtube.com/vi/${item.id}/maxresdefault.jpg`,
      duration: formatDuration(item.durationSec || 0),
      durationSec: item.durationSec || 0,
      group: groupName,
      category: categoryName,
      type: playlistName,
      date: publishDate,
      resolution,
      viewCount
    });

    fetched++;
    const resLabel = resolution ? ` [${resolution}]` : '';
    log(`${progress} ✓${resLabel} ${item.title.substring(0, 50)}...`);
    await sleep(DELAY_MS);
  }

  log(`\n    📊 ${cached} cached, ${fetched} fetched, ${total} total.`);
  return videos;
}

/**
 * Main fetch function. Can be imported or run as CLI.
 * @param {object} opts - { targetGroup, targetCategory, targetPlaylist, log }
 */
export async function fetchVideos(opts = {}) {
  const { targetGroup = null, targetCategory = null, targetPlaylist = null, log = console.log } = opts;

  log('\n🎬 YouTube Video Library — Fetch Script (3-Level + Cache)\n');

  if (!fs.existsSync(PLAYLISTS_FILE)) {
    throw new Error(`Playlists file not found at ${PLAYLISTS_FILE}`);
  }

  const playlists = JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf-8'));

  // Load existing data + build cache
  let existingGroups = {};
  if (fs.existsSync(VIDEOS_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(VIDEOS_FILE, 'utf-8'));
      existingGroups = existing.groups || {};
    } catch (e) {
      log('⚠️  Could not parse existing videos.json, starting fresh.');
    }
  }

  const videoCache = buildVideoCache(existingGroups);
  log(`📦 Cache: ${videoCache.size} existing videos loaded.\n`);

  // Validate CLI args
  if (targetGroup && !playlists[targetGroup]) {
    throw new Error(`Group "${targetGroup}" not found. Available: ${Object.keys(playlists).join(', ')}`);
  }
  if (targetGroup && targetCategory) {
    const cats = playlists[targetGroup].categories || {};
    if (!cats[targetCategory]) {
      throw new Error(`Category "${targetCategory}" not found. Available: ${Object.keys(cats).join(', ')}`);
    }
    if (targetPlaylist && !cats[targetCategory][targetPlaylist]) {
      throw new Error(`Playlist "${targetPlaylist}" not found. Available: ${Object.keys(cats[targetCategory]).join(', ')}`);
    }
  }

  const mode = targetPlaylist
    ? `Single playlist — "${targetGroup}" > "${targetCategory}" > "${targetPlaylist}"`
    : targetCategory
    ? `Category — "${targetGroup}" > "${targetCategory}"`
    : targetGroup
    ? `Group — "${targetGroup}"`
    : 'Full update';
  log(`📂 Mode: ${mode}\n`);

  if (!targetGroup) existingGroups = {};

  const groupsToProcess = targetGroup
    ? [[targetGroup, playlists[targetGroup]]]
    : Object.entries(playlists);

  for (const [groupName, groupConfig] of groupsToProcess) {
    const icon = groupConfig.icon || '';
    const allCategories = groupConfig.categories || {};

    if (!existingGroups[groupName]) existingGroups[groupName] = { icon, categories: {} };
    existingGroups[groupName].icon = icon;
    if (!targetCategory) existingGroups[groupName].categories = {};

    const catsToProcess = targetCategory
      ? [[targetCategory, allCategories[targetCategory]]]
      : Object.entries(allCategories);

    if (catsToProcess.length === 0) {
      log(`⏭  Skipping "${groupName}" — no categories defined.\n`);
      continue;
    }

    for (const [catName, catPlaylists] of catsToProcess) {
      if (!existingGroups[groupName].categories[catName]) existingGroups[groupName].categories[catName] = {};
      if (!targetPlaylist) existingGroups[groupName].categories[catName] = {};

      const plToProcess = targetPlaylist
        ? [[targetPlaylist, catPlaylists[targetPlaylist]]]
        : Object.entries(catPlaylists || {});

      for (const [plName, idOrUrl] of plToProcess) {
        log(`\n━━━ ${icon} ${groupName} > ${catName} > ${plName} ━━━`);
        log(`    ID: ${idOrUrl}`);
        if (!idOrUrl) { log(`    ⚠️  No ID, skipping.`); continue; }

        try {
          const videos = await fetchPlaylist(idOrUrl, groupName, catName, plName, videoCache, log);
          existingGroups[groupName].categories[catName][plName] = videos;
          log(`    ✅ ${plName}: ${videos.length} videos saved.`);
        } catch (err) {
          log(`    ❌ Error: ${err.message}`);
        }
      }
    }
  }

  // Write
  const output = { lastUpdated: new Date().toISOString(), groups: existingGroups };
  fs.writeFileSync(VIDEOS_FILE, JSON.stringify(output, null, 2));

  let totalVideos = 0, totalPlaylists = 0;
  for (const group of Object.values(existingGroups)) {
    for (const cat of Object.values(group.categories || {})) {
      for (const vids of Object.values(cat || {})) {
        totalVideos += vids.length;
        totalPlaylists++;
      }
    }
  }

  const summary = `✅ Done! ${totalVideos} videos across ${totalPlaylists} playlists.`;
  log(`\n${'═'.repeat(40)}\n${summary}\n${'═'.repeat(40)}\n`);
  return summary;
}

// CLI entry point
if (process.argv[1]?.includes('fetchVideos')) {
  const args = process.argv.slice(2);
  fetchVideos({
    targetGroup: args[0] || null,
    targetCategory: args[1] || null,
    targetPlaylist: args[2] || null,
  }).catch((err) => {
    console.error('💥 Fatal:', err.message);
    process.exit(1);
  });
}
