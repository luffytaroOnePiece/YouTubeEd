import React, { useMemo, useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart, Line
} from 'recharts';

function AnalyticsDashboard({ onClose, videos, allVideos, favorites = [], isMonitorSize, onFilterUpdate, hasActiveFilters, onResetFilters }) {
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    setIsMounted(true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // ──────────────────────────────────────────────────────────
  //  CORE STATS (same as before + extended)
  // ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let totalWatchSec = 0;
    const groupWatchTime = {};
    let latestVideo = null;
    let earliestVideo = null;
    let highResCount = 0;

    const groupsCount = {};
    const resCount = {};
    const typeCount = {};
    const categoryCount = {};
    const yearCount = {};
    const monthCount = {};

    videos.forEach(v => {
      const sec = v.durationSec || 0;
      totalWatchSec += sec;

      if (v.group) {
        groupsCount[v.group] = (groupsCount[v.group] || 0) + 1;
        groupWatchTime[v.group] = (groupWatchTime[v.group] || 0) + sec;
      }

      if (v.resolution) {
        resCount[v.resolution] = (resCount[v.resolution] || 0) + 1;
        if (v.resolution === '4K' || v.resolution === '8K') {
          highResCount++;
        }
      }

      if (v.type) typeCount[v.type] = (typeCount[v.type] || 0) + 1;

      if (v.category) {
        categoryCount[v.category] = (categoryCount[v.category] || 0) + 1;
      }

      if (v.date) {
        const d = new Date(v.date);
        if (!isNaN(d.valueOf())) {
          const yearKey = `${d.getFullYear()}`;
          yearCount[yearKey] = (yearCount[yearKey] || 0) + 1;

          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          monthCount[monthKey] = (monthCount[monthKey] || 0) + 1;

          if (!latestVideo || d > new Date(latestVideo.date)) {
            latestVideo = v;
          }
          if (!earliestVideo || d < new Date(earliestVideo.date)) {
            earliestVideo = v;
          }
        }
      }
    });

    const hours = Math.floor(totalWatchSec / 3600);
    const mins = Math.floor((totalWatchSec % 3600) / 60);
    const totalDays = (totalWatchSec / 86400).toFixed(1);

    const avgSec = videos.length ? Math.floor(totalWatchSec / videos.length) : 0;
    const avgMins = Math.floor(avgSec / 60);
    const avgRemainderSec = avgSec % 60;
    const avgDurationStr = `${avgMins}m ${avgRemainderSec}s`;

    const resData = Object.entries(resCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const groupTimePieData = Object.entries(groupWatchTime).map(([name, val]) => ({ name, value: Math.floor(val / 3600) })).sort((a, b) => b.value - a.value);
    const topTypes = Object.entries(typeCount).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
    const catData = Object.entries(categoryCount).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    const timelineData = Object.entries(yearCount).map(([name, count]) => ({ name, count, raw: name })).sort((a, b) => a.raw.localeCompare(b.raw));

    const premiumPct = videos.length ? Math.round((highResCount / videos.length) * 100) : 0;

    // Monthly growth data (for Growth Velocity)
    const sortedMonths = Object.entries(monthCount)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => a.key.localeCompare(b.key));

    // Rolling 3-month average
    const monthlyGrowthData = sortedMonths.map((item, idx) => {
      const window = sortedMonths.slice(Math.max(0, idx - 2), idx + 1);
      const avg = Math.round(window.reduce((s, w) => s + w.count, 0) / window.length);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const [y, m] = item.key.split('-');
      const label = `${monthNames[parseInt(m) - 1]} '${y.slice(2)}`;
      return { name: label, count: item.count, trend: avg, raw: item.key };
    });

    // Growth rate: avg of last 6 months
    const last6 = sortedMonths.slice(-6);
    const growthRate = last6.length ? (last6.reduce((s, m) => s + m.count, 0) / last6.length).toFixed(1) : 0;
    const prev6 = sortedMonths.slice(-12, -6);
    const prevRate = prev6.length ? (prev6.reduce((s, m) => s + m.count, 0) / prev6.length) : 0;
    const growthTrend = parseFloat(growthRate) >= prevRate ? 'up' : 'down';

    return {
      totalVideos: videos.length,
      watchHours: hours,
      watchMins: mins,
      totalDays,
      avgDurationStr,
      premiumPct,
      highResCount,
      resData,
      groupTimePieData,
      groupsCount,
      topTypes,
      catData,
      timelineData,
      monthlyGrowthData,
      growthRate,
      growthTrend,
      typeCount,
      categoryCount,
      latestVideo,
      earliestVideo,
      monthCount,
      totalWatchSec
    };
  }, [videos]);

  // ──────────────────────────────────────────────────────────
  //  LIBRARY HEALTH SCORE
  // ──────────────────────────────────────────────────────────
  const healthScore = useMemo(() => {
    if (videos.length === 0) return { score: 0, diversity: 0, freshness: 0, premium: 0, volume: 0 };

    // Diversity (0-25): based on unique types and categories
    const uniqueTypes = Object.keys(stats.typeCount).length;
    const uniqueCats = Object.keys(stats.categoryCount).length;
    const diversityRaw = Math.min(uniqueTypes * 3 + uniqueCats * 2, 25);

    // Freshness (0-25): based on how recent additions are
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 3600 * 1000;
    const recentCount = videos.filter(v => v.date && (now - new Date(v.date).getTime()) < thirtyDaysMs).length;
    const freshnessRaw = Math.min(Math.round((recentCount / Math.max(videos.length, 1)) * 100), 25);

    // Premium (0-25): based on 4K+ ratio
    const premiumRaw = Math.min(Math.round(stats.premiumPct / 4), 25);

    // Volume (0-25): based on total videos (100 = full marks)
    const volumeRaw = Math.min(Math.round((videos.length / 100) * 25), 25);

    const score = diversityRaw + freshnessRaw + premiumRaw + volumeRaw;

    return {
      score: Math.min(score, 100),
      diversity: diversityRaw,
      freshness: freshnessRaw,
      premium: premiumRaw,
      volume: volumeRaw
    };
  }, [videos, stats]);

  // ──────────────────────────────────────────────────────────
  //  CONTENT DIVERSITY RADAR
  // ──────────────────────────────────────────────────────────
  const radarData = useMemo(() => {
    const groups = stats.groupsCount;
    const total = videos.length || 1;
    return Object.entries(groups).map(([name, count]) => ({
      subject: name,
      value: Math.round((count / total) * 100),
      fullMark: 100
    }));
  }, [stats, videos]);

  // ──────────────────────────────────────────────────────────
  //  FAVORITES INSIGHTS
  // ──────────────────────────────────────────────────────────
  const favInsights = useMemo(() => {
    const favSet = new Set(favorites);
    const favVideos = (allVideos || videos).filter(v => favSet.has(v.youtubeLinkID));
    const favCount = favVideos.length;
    const totalCount = (allVideos || videos).length;
    const favPct = totalCount ? Math.round((favCount / totalCount) * 100) : 0;

    // Most favorited type
    const favTypeCount = {};
    const favResCount = {};
    const favCatCount = {};
    favVideos.forEach(v => {
      if (v.type) favTypeCount[v.type] = (favTypeCount[v.type] || 0) + 1;
      if (v.resolution) favResCount[v.resolution] = (favResCount[v.resolution] || 0) + 1;
      if (v.category) favCatCount[v.category] = (favCatCount[v.category] || 0) + 1;
    });

    const topFavType = Object.entries(favTypeCount).sort((a, b) => b[1] - a[1])[0];
    const topFavRes = Object.entries(favResCount).sort((a, b) => b[1] - a[1])[0];
    const topFavCat = Object.entries(favCatCount).sort((a, b) => b[1] - a[1])[0];

    return {
      count: favCount,
      pct: favPct,
      topType: topFavType ? topFavType[0] : 'N/A',
      topTypeCount: topFavType ? topFavType[1] : 0,
      topRes: topFavRes ? topFavRes[0] : 'N/A',
      topResCount: topFavRes ? topFavRes[1] : 0,
      topCat: topFavCat ? topFavCat[0] : 'N/A',
      topCatCount: topFavCat ? topFavCat[1] : 0
    };
  }, [favorites, allVideos, videos]);

  // ──────────────────────────────────────────────────────────
  //  COLLECTION MILESTONES
  // ──────────────────────────────────────────────────────────
  const milestones = useMemo(() => {
    const sorted = [...videos].filter(v => v.date).sort((a, b) => new Date(a.date) - new Date(b.date));
    const items = [];

    if (sorted.length > 0) {
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const firstDate = new Date(first.date);
      const lastDate = new Date(last.date);
      const ageMs = lastDate - firstDate;
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      const ageYears = Math.floor(ageDays / 365);
      const ageRemainderMonths = Math.floor((ageDays % 365) / 30);

      items.push({
        icon: '🎬',
        label: 'First Video Added',
        value: first.title.slice(0, 50) + (first.title.length > 50 ? '...' : ''),
        sub: firstDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      });

      items.push({
        icon: '📅',
        label: 'Library Age',
        value: ageYears > 0 ? `${ageYears} year${ageYears > 1 ? 's' : ''}, ${ageRemainderMonths} month${ageRemainderMonths !== 1 ? 's' : ''}` : `${ageDays} days`,
        sub: `${firstDate.getFullYear()} — ${lastDate.getFullYear()}`
      });
    }

    // Biggest month
    const monthEntries = Object.entries(stats.monthCount).sort((a, b) => b[1] - a[1]);
    if (monthEntries.length > 0) {
      const [key, count] = monthEntries[0];
      const [y, m] = key.split('-');
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      items.push({
        icon: '🏆',
        label: 'Biggest Month',
        value: `${count} videos added`,
        sub: `${monthNames[parseInt(m) - 1]} ${y}`
      });
    }

    // Milestone markers
    [50, 100, 200, 300, 500].forEach(n => {
      if (sorted.length >= n) {
        const vid = sorted[n - 1];
        const d = new Date(vid.date);
        items.push({
          icon: '🎯',
          label: `${n}th Video`,
          value: vid.title.slice(0, 45) + (vid.title.length > 45 ? '...' : ''),
          sub: d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        });
      }
    });

    return items;
  }, [videos, stats]);

  // ──────────────────────────────────────────────────────────
  //  DURATION LEADERBOARD
  // ──────────────────────────────────────────────────────────
  const durationLeaderboard = useMemo(() => {
    const sorted = [...videos].filter(v => v.durationSec).sort((a, b) => b.durationSec - a.durationSec);
    return {
      longest: sorted.slice(0, 5),
      shortest: sorted.slice(-5).reverse()
    };
  }, [videos]);

  // ──────────────────────────────────────────────────────────
  //  VIEWS INSIGHTS
  // ──────────────────────────────────────────────────────────
  const viewsInsights = useMemo(() => {
    const withViews = videos.filter(v => v.viewCount && v.viewCount > 0);
    const hasViewData = withViews.length > 0;

    if (!hasViewData) {
      return { hasViewData: false, totalViews: 0, avgViews: 0, topViewed: [], viewsByGroup: [], viewsByType: [], coveragePct: 0 };
    }

    const totalViews = withViews.reduce((sum, v) => sum + v.viewCount, 0);
    const avgViews = Math.round(totalViews / withViews.length);
    const coveragePct = Math.round((withViews.length / videos.length) * 100);

    // Top 10 most viewed
    const topViewed = [...withViews].sort((a, b) => b.viewCount - a.viewCount).slice(0, 10);

    // Views by group
    const groupViews = {};
    withViews.forEach(v => {
      if (v.group) groupViews[v.group] = (groupViews[v.group] || 0) + v.viewCount;
    });
    const viewsByGroup = Object.entries(groupViews)
      .map(([name, views]) => ({ name, views: Math.round(views / 1000) })) // in thousands
      .sort((a, b) => b.views - a.views);

    // Views by type (top 5)
    const typeViews = {};
    withViews.forEach(v => {
      if (v.type) typeViews[v.type] = (typeViews[v.type] || 0) + v.viewCount;
    });
    const viewsByType = Object.entries(typeViews)
      .map(([name, views]) => ({ name, views: parseFloat((views / 1000000).toFixed(1)) }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    return { hasViewData: true, totalViews, avgViews, topViewed, viewsByGroup, viewsByType, coveragePct };
  }, [videos]);

  // ──────────────────────────────────────────────────────────
  //  ACTIVITY HEATMAP
  // ──────────────────────────────────────────────────────────
  const heatmapData = useMemo(() => {
    const grid = {}; // { "YYYY-MM": { 0: count, 1: count, ... 6: count } }
    const monthSet = new Set();

    videos.forEach(v => {
      if (!v.date) return;
      const d = new Date(v.date);
      if (isNaN(d.valueOf())) return;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const dayOfWeek = d.getDay(); // 0=Sun, 6=Sat
      monthSet.add(monthKey);
      if (!grid[monthKey]) grid[monthKey] = {};
      grid[monthKey][dayOfWeek] = (grid[monthKey][dayOfWeek] || 0) + 1;
    });

    const months = [...monthSet].sort().slice(-12); // Last 12 months
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Find max for color scaling
    let maxCount = 0;
    months.forEach(m => {
      for (let d = 0; d < 7; d++) {
        const val = grid[m]?.[d] || 0;
        if (val > maxCount) maxCount = val;
      }
    });

    return { grid, months, dayNames, maxCount };
  }, [videos]);

  // ──────────────────────────────────────────────────────────
  //  RECENTLY ADDED TABLE
  // ──────────────────────────────────────────────────────────
  const topRecentVideos = useMemo(() => {
    return [...videos].filter(v => v.date).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);
  }, [videos]);

  // ──────────────────────────────────────────────────────────
  //  COLORS & HELPERS
  // ──────────────────────────────────────────────────────────
  const PIE_COLORS = ['#ff2d55', '#5856d6', '#ff9500', '#34c759', '#32ade6'];
  const RES_COLORS = { '8K': '#ff9500', '4K': '#007aff', '1080p': '#8e8e93' };
  const getResColor = (res) => RES_COLORS[res] || '#636366';

  const getHealthColor = (score) => {
    if (score >= 75) return '#34c759';
    if (score >= 50) return '#ff9500';
    if (score >= 25) return '#ffcc02';
    return '#ff3b30';
  };

  const renderPieLabel = (props) => {
    const { name, percent } = props;
    if (typeof percent !== 'number' || percent < 0.03) return null;
    return `\u00A0\u00A0${name} ${(percent * 100).toFixed(0)}%\u00A0\u00A0`;
  };

  const getHeatmapColor = (count, max) => {
    if (!count || count === 0) return 'rgba(255,255,255,0.03)';
    const intensity = count / (max || 1);
    if (intensity > 0.75) return '#34c759';
    if (intensity > 0.5) return '#30d158';
    if (intensity > 0.25) return 'rgba(52, 199, 89, 0.5)';
    return 'rgba(52, 199, 89, 0.2)';
  };

  const formatMonthLabel = (rawKey) => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [y, m] = rawKey.split('-');
    return `${monthNames[parseInt(m) - 1]}`;
  };

  // Health score ring
  const healthRadius = 54;
  const healthCircumference = 2 * Math.PI * healthRadius;
  const healthOffset = healthCircumference - (healthScore.score / 100) * healthCircumference;

  // ──────────────────────────────────────────────────────────
  //  TAB: OVERVIEW
  // ──────────────────────────────────────────────────────────
  const renderOverview = () => (
    <>
      {/* Hero KPI Row */}
      <div className="analytics-hero-row">
        {/* Health Score Gauge */}
        <div className="analytics-health-card">
          <div className="health-gauge">
            <svg viewBox="0 0 128 128" className="health-gauge__svg">
              <circle
                cx="64" cy="64" r={healthRadius}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="8"
              />
              <circle
                cx="64" cy="64" r={healthRadius}
                fill="none"
                stroke={getHealthColor(healthScore.score)}
                strokeWidth="8"
                strokeDasharray={healthCircumference}
                strokeDashoffset={healthOffset}
                strokeLinecap="round"
                className="health-gauge__ring"
                transform="rotate(-90 64 64)"
              />
            </svg>
            <div className="health-gauge__center">
              <span className="health-gauge__score" style={{ color: getHealthColor(healthScore.score) }}>
                {healthScore.score}
              </span>
              <span className="health-gauge__label">Health</span>
            </div>
          </div>
          <div className="health-breakdown">
            <div className="health-breakdown__item">
              <span className="health-breakdown__name">Diversity</span>
              <div className="health-breakdown__bar">
                <div className="health-breakdown__fill" style={{ width: `${(healthScore.diversity / 25) * 100}%`, background: '#5856d6' }} />
              </div>
              <span className="health-breakdown__val">{healthScore.diversity}/25</span>
            </div>
            <div className="health-breakdown__item">
              <span className="health-breakdown__name">Freshness</span>
              <div className="health-breakdown__bar">
                <div className="health-breakdown__fill" style={{ width: `${(healthScore.freshness / 25) * 100}%`, background: '#34c759' }} />
              </div>
              <span className="health-breakdown__val">{healthScore.freshness}/25</span>
            </div>
            <div className="health-breakdown__item">
              <span className="health-breakdown__name">Premium</span>
              <div className="health-breakdown__bar">
                <div className="health-breakdown__fill" style={{ width: `${(healthScore.premium / 25) * 100}%`, background: '#ff9500' }} />
              </div>
              <span className="health-breakdown__val">{healthScore.premium}/25</span>
            </div>
            <div className="health-breakdown__item">
              <span className="health-breakdown__name">Volume</span>
              <div className="health-breakdown__bar">
                <div className="health-breakdown__fill" style={{ width: `${(healthScore.volume / 25) * 100}%`, background: '#ff2d55' }} />
              </div>
              <span className="health-breakdown__val">{healthScore.volume}/25</span>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="analytics-kpi-grid">
          <div className="apple-card">
            <span className="analytics-card__label">Total Watch Time</span>
            <span className="analytics-card__val">{stats.watchHours}<span style={{ fontSize: '1.2rem' }}>h</span> {stats.watchMins}<span style={{ fontSize: '1.2rem' }}>m</span></span>
            <span className="analytics-card__subval">{stats.totalDays} days · Avg {stats.avgDurationStr}</span>
          </div>
          <div className="apple-card">
            <span className="analytics-card__label">Growth Rate</span>
            <span className="analytics-card__val">
              <span className={`growth-arrow growth-arrow--${stats.growthTrend}`}>
                {stats.growthTrend === 'up' ? '↑' : '↓'}
              </span>
              {stats.growthRate}<span style={{ fontSize: '1rem' }}>/mo</span>
            </span>
            <span className="analytics-card__subval">Avg {stats.growthTrend === 'up' ? 'accelerating' : 'slowing'} vs prev 6mo</span>
          </div>
          <div className="apple-card">
            <span className="analytics-card__label">4K+ Premium</span>
            <span className="analytics-card__val">{stats.premiumPct}%</span>
            <span className="analytics-card__subval">{stats.highResCount} of {stats.totalVideos} in 8K/4K</span>
          </div>
          <div className="apple-card">
            <span className="analytics-card__label">Favorites</span>
            <span className="analytics-card__val">{favInsights.count}</span>
            <span className="analytics-card__subval">{favInsights.pct}% of library · Top: {favInsights.topType}</span>
          </div>
        </div>
      </div>

      {/* Growth Velocity Chart */}
      <div className="apple-chart-box analytics-velocity-chart">
        <div className="analytics-chart-header">
          <h3 className="analytics-chart-title">Growth Velocity</h3>
          <span className="analytics-chart-badge">
            {stats.growthTrend === 'up' ? '↗' : '↘'} {stats.growthRate} videos/month
          </span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={stats.monthlyGrowthData.slice(-18)}>
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#007aff" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#007aff" stopOpacity={0.2} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.6)' }} axisLine={false} tickLine={false} interval={1} />
            <YAxis stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.6)' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ backgroundColor: 'rgba(30,30,30,0.9)', backdropFilter: 'blur(12px)', borderRadius: '14px', border: '0.5px solid rgba(255,255,255,0.1)', padding: '12px 16px' }} itemStyle={{ color: '#fff', fontSize: '0.85rem' }} labelStyle={{ color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }} />
            <Bar dataKey="count" fill="url(#barGrad)" radius={[4, 4, 0, 0]} name="Added" />
            <Line type="monotone" dataKey="trend" stroke="#ff9500" strokeWidth={2.5} dot={false} name="3mo Avg" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Two-column: Radar + Pie */}
      <div className="analytics-charts">
        <div className="apple-chart-box">
          <h3 className="analytics-chart-title">Content Diversity</h3>
          {radarData.length > 2 ? (
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.7)' }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar name="Distribution" dataKey="value" stroke="#5856d6" fill="#5856d6" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
              Need 3+ groups for radar chart
            </div>
          )}
        </div>

        <div className="apple-chart-box">
          <h3 className="analytics-chart-title">Watch Time by Group (Hours)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={stats.groupTimePieData}
                dataKey="value" nameKey="name"
                cx="50%" cy="50%" innerRadius={55} outerRadius={75}
                fill="#8884d8" paddingAngle={4} stroke="none"
                label={renderPieLabel}
                labelLine={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1.5 }}
              >
                {stats.groupTimePieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                    onClick={() => onFilterUpdate && onFilterUpdate('group', entry.name)}
                    style={{ cursor: 'pointer', outline: 'none' }}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'rgba(30,30,30,0.85)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: '0.5px solid rgba(255,255,255,0.1)' }} itemStyle={{ color: '#fff' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Favorites Insights Row */}
      {favInsights.count > 0 && (
        <div className="analytics-fav-row">
          <h3 className="analytics-section-title">Favorites Profile</h3>
          <div className="analytics-fav-cards">
            <div className="fav-insight-card">
              <span className="fav-insight-card__val">{favInsights.count}</span>
              <span className="fav-insight-card__label">Total Favorites</span>
              <span className="fav-insight-card__sub">{favInsights.pct}% of library</span>
            </div>
            <div className="fav-insight-card">
              <span className="fav-insight-card__val">{favInsights.topType}</span>
              <span className="fav-insight-card__label">Most Loved Type</span>
              <span className="fav-insight-card__sub">{favInsights.topTypeCount} favorited</span>
            </div>
            <div className="fav-insight-card">
              <span className="fav-insight-card__val">{favInsights.topCat}</span>
              <span className="fav-insight-card__label">Top Category</span>
              <span className="fav-insight-card__sub">{favInsights.topCatCount} favorited</span>
            </div>
            <div className="fav-insight-card">
              <span className="fav-insight-card__val">{favInsights.topRes}</span>
              <span className="fav-insight-card__label">Preferred Quality</span>
              <span className="fav-insight-card__sub">{favInsights.topResCount} at this res</span>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // ──────────────────────────────────────────────────────────
  //  TAB: DEEP DIVE
  // ──────────────────────────────────────────────────────────
  const renderDeepDive = () => (
    <>
      {/* Views Insights Section */}
      {viewsInsights.hasViewData && (
        <div className="analytics-views-section">
          <h3 className="analytics-section-title">Views Intelligence</h3>
          <div className="analytics-views-kpis">
            <div className="fav-insight-card">

              <span className="fav-insight-card__val">{viewsInsights.totalViews >= 1000000 ? `${(viewsInsights.totalViews / 1000000).toFixed(1)}M` : viewsInsights.totalViews >= 1000 ? `${(viewsInsights.totalViews / 1000).toFixed(1)}K` : viewsInsights.totalViews}</span>
              <span className="fav-insight-card__label">Total Views</span>
              <span className="fav-insight-card__sub">{viewsInsights.coveragePct}% of library tracked</span>
            </div>
            <div className="fav-insight-card">

              <span className="fav-insight-card__val">{viewsInsights.avgViews >= 1000000 ? `${(viewsInsights.avgViews / 1000000).toFixed(1)}M` : viewsInsights.avgViews >= 1000 ? `${(viewsInsights.avgViews / 1000).toFixed(0)}K` : viewsInsights.avgViews}</span>
              <span className="fav-insight-card__label">Avg Views</span>
              <span className="fav-insight-card__sub">Per video</span>
            </div>
            <div className="fav-insight-card">

              <span className="fav-insight-card__val">{viewsInsights.topViewed.length > 0 ? (viewsInsights.topViewed[0].viewCount >= 1000000 ? `${(viewsInsights.topViewed[0].viewCount / 1000000).toFixed(1)}M` : `${(viewsInsights.topViewed[0].viewCount / 1000).toFixed(0)}K`) : '—'}</span>
              <span className="fav-insight-card__label">Most Viewed</span>
              <span className="fav-insight-card__sub" style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{viewsInsights.topViewed[0]?.title?.slice(0, 30) || '—'}...</span>
            </div>
          </div>

          {/* Most Viewed Leaderboard */}
          <div className="analytics-leaderboard-card" style={{ marginTop: '16px' }}>
            <h3 className="analytics-section-title">Most Viewed Videos</h3>
            <div className="analytics-leaderboard__list">
              {viewsInsights.topViewed.map((vid, idx) => (
                <div key={vid.youtubeLinkID} className="analytics-leaderboard__item">
                  <span className="analytics-leaderboard__rank">{idx + 1}</span>
                  <img src={vid.thumbnail} alt="" className="analytics-leaderboard__thumb" loading="lazy" />
                  <div className="analytics-leaderboard__info">
                    <span className="analytics-leaderboard__title" title={vid.title}>{vid.title}</span>
                    <span className="analytics-leaderboard__meta">{vid.group} · {vid.category} · {vid.type}</span>
                  </div>
                  <span className="analytics-leaderboard__duration" style={{ color: '#34c759' }}>
                    {vid.viewCount >= 1000000 ? `${(vid.viewCount / 1000000).toFixed(1)}M` : vid.viewCount >= 1000 ? `${Math.round(vid.viewCount / 1000)}K` : vid.viewCount}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Views by Type Chart */}
          {viewsInsights.viewsByType.length > 0 && (
            <div className="apple-chart-box" style={{ marginTop: '16px' }}>
              <h3 className="analytics-chart-title">Views by Content Type (M)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={viewsInsights.viewsByType}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.8)' }} axisLine={false} tickLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.8)' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'rgba(30,30,30,0.85)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: '0.5px solid rgba(255,255,255,0.1)' }} itemStyle={{ color: '#fff' }} formatter={(val) => [`${val}M views`, 'Views']} />
                  <Bar dataKey="views" fill="#34c759" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {!viewsInsights.hasViewData && (
        <div className="analytics-views-empty">

          <span className="analytics-views-empty__title">Views Data Not Yet Available</span>
          <span className="analytics-views-empty__sub">Re-fetch your playlists to start collecting view counts for each video.</span>
        </div>
      )}

      <div className="analytics-charts">
        <div className="apple-chart-box">
          <h3 className="analytics-chart-title">Top 5 Content Types</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.topTypes}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.8)' }} axisLine={false} tickLine={false} />
              <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.8)' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'rgba(30,30,30,0.85)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: '0.5px solid rgba(255,255,255,0.1)' }} itemStyle={{ color: '#fff' }} />
              <Bar
                dataKey="count"
                fill="#ff2d55"
                radius={[6, 6, 0, 0]}
                onClick={(data) => onFilterUpdate && onFilterUpdate('type', data.name)}
                style={{ cursor: 'pointer' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="apple-chart-box">
          <h3 className="analytics-chart-title">Resolution Breakdown</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={stats.resData}
                dataKey="value" nameKey="name"
                cx="50%" cy="50%" innerRadius={55} outerRadius={75}
                fill="#8884d8" paddingAngle={4} stroke="none"
                label={renderPieLabel}
                labelLine={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1.5 }}
              >
                {stats.resData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PIE_COLORS[(index + 2) % PIE_COLORS.length]}
                    onClick={() => onFilterUpdate && onFilterUpdate('resolution', entry.name)}
                    style={{ cursor: 'pointer', outline: 'none' }}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'rgba(30,30,30,0.85)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: '0.5px solid rgba(255,255,255,0.1)' }} itemStyle={{ color: '#fff' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="apple-chart-box" style={{ gridColumn: '1 / -1' }}>
          <h3 className="analytics-chart-title">Category Scale (Language)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.catData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.08)" />
              <XAxis type="number" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.8)' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.8)' }} width={100} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'rgba(30,30,30,0.85)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: '0.5px solid rgba(255,255,255,0.1)' }} itemStyle={{ color: '#fff' }} />
              <Bar
                dataKey="count"
                fill="#32ade6"
                radius={[0, 6, 6, 0]}
                onClick={(data) => onFilterUpdate && onFilterUpdate('category', data.name)}
                style={{ cursor: 'pointer' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activity Heatmap */}
      <div className="apple-chart-box analytics-heatmap-section">
        <h3 className="analytics-chart-title">Activity Heatmap</h3>
        <p className="analytics-chart-subtitle">When you add content (last 12 months)</p>
        <div className="analytics-heatmap">
          <div className="analytics-heatmap__labels">
            {heatmapData.dayNames.map(day => (
              <span key={day} className="analytics-heatmap__day-label">{day}</span>
            ))}
          </div>
          <div className="analytics-heatmap__grid">
            {heatmapData.months.map(month => (
              <div key={month} className="analytics-heatmap__col">
                <span className="analytics-heatmap__month-label">{formatMonthLabel(month)}</span>
                <div className="analytics-heatmap__cells">
                  {[0, 1, 2, 3, 4, 5, 6].map(day => {
                    const count = heatmapData.grid[month]?.[day] || 0;
                    return (
                      <div
                        key={day}
                        className="analytics-heatmap__cell"
                        style={{ backgroundColor: getHeatmapColor(count, heatmapData.maxCount) }}
                        title={`${heatmapData.dayNames[day]}, ${month}: ${count} video${count !== 1 ? 's' : ''}`}
                      >
                        {count > 0 && <span className="analytics-heatmap__cell-count">{count}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="analytics-heatmap__legend">
          <span className="analytics-heatmap__legend-label">Less</span>
          <div className="analytics-heatmap__legend-cell" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }} />
          <div className="analytics-heatmap__legend-cell" style={{ backgroundColor: 'rgba(52,199,89,0.2)' }} />
          <div className="analytics-heatmap__legend-cell" style={{ backgroundColor: 'rgba(52,199,89,0.5)' }} />
          <div className="analytics-heatmap__legend-cell" style={{ backgroundColor: '#30d158' }} />
          <div className="analytics-heatmap__legend-cell" style={{ backgroundColor: '#34c759' }} />
          <span className="analytics-heatmap__legend-label">More</span>
        </div>
      </div>

      {/* Duration Leaderboard */}
      <div className="analytics-leaderboard-section">
        <div className="analytics-leaderboard-card">
          <h3 className="analytics-section-title">🏆 Longest Videos</h3>
          <div className="analytics-leaderboard__list">
            {durationLeaderboard.longest.map((vid, idx) => (
              <div key={vid.youtubeLinkID} className="analytics-leaderboard__item">
                <span className="analytics-leaderboard__rank">{idx + 1}</span>
                <img src={vid.thumbnail} alt="" className="analytics-leaderboard__thumb" loading="lazy" />
                <div className="analytics-leaderboard__info">
                  <span className="analytics-leaderboard__title" title={vid.title}>{vid.title}</span>
                  <span className="analytics-leaderboard__meta">{vid.group} · {vid.category}</span>
                </div>
                <span className="analytics-leaderboard__duration">{vid.duration}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="analytics-leaderboard-card">
          <h3 className="analytics-section-title">⚡ Shortest Videos</h3>
          <div className="analytics-leaderboard__list">
            {durationLeaderboard.shortest.map((vid, idx) => (
              <div key={vid.youtubeLinkID} className="analytics-leaderboard__item">
                <span className="analytics-leaderboard__rank">{idx + 1}</span>
                <img src={vid.thumbnail} alt="" className="analytics-leaderboard__thumb" loading="lazy" />
                <div className="analytics-leaderboard__info">
                  <span className="analytics-leaderboard__title" title={vid.title}>{vid.title}</span>
                  <span className="analytics-leaderboard__meta">{vid.group} · {vid.category}</span>
                </div>
                <span className="analytics-leaderboard__duration">{vid.duration}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  // ──────────────────────────────────────────────────────────
  //  TAB: COLLECTION
  // ──────────────────────────────────────────────────────────
  const renderCollection = () => (
    <>
      {/* Milestones */}
      <div className="apple-chart-box analytics-milestones-section">
        <h3 className="analytics-chart-title">📅 Collection Milestones</h3>
        <div className="analytics-milestones">
          {milestones.map((m, idx) => (
            <div key={idx} className="analytics-milestone" style={{ animationDelay: `${idx * 0.08}s` }}>
              <div className="analytics-milestone__icon">{m.icon}</div>
              <div className="analytics-milestone__line" />
              <div className="analytics-milestone__content">
                <span className="analytics-milestone__label">{m.label}</span>
                <span className="analytics-milestone__value">{m.value}</span>
                <span className="analytics-milestone__sub">{m.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Additions Over Time (Yearly) */}
      <div className="apple-chart-box">
        <h3 className="analytics-chart-title">Yearly Additions</h3>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={stats.timelineData}>
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#007aff" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#007aff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.8)' }} axisLine={false} tickLine={false} />
            <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.8)' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ backgroundColor: 'rgba(30,30,30,0.85)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: '0.5px solid rgba(255,255,255,0.1)' }} itemStyle={{ color: '#fff' }} />
            <Area type="monotone" dataKey="count" stroke="#007aff" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recently Added Table */}
      <div className="apple-table-section">
        <h3 className="analytics-section-title">Recently Added</h3>
        <div className="analytics-table-container">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Thumbnail</th>
                <th>Title</th>
                <th>Group</th>
                <th>Category</th>
                <th>Date</th>
                <th>Resolution</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {topRecentVideos.map(vid => (
                <tr key={vid.youtubeLinkID}>
                  <td>
                    <img src={vid.thumbnail} alt="thumb" className="analytics-table__thumb" loading="lazy" />
                  </td>
                  <td>
                    <div className="analytics-table__title" title={vid.title}>
                      {vid.title}
                    </div>
                  </td>
                  <td>{vid.group}</td>
                  <td>{vid.category}</td>
                  <td>{new Date(vid.date).toLocaleDateString()}</td>
                  <td>
                    <span className="analytics-table__res-badge" style={{ backgroundColor: getResColor(vid.resolution) }}>{vid.resolution}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{vid.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  return (
    <div className="analytics-overlay" style={{ zoom: isMonitorSize ? (1 / 1.75) : 1 }}>
      <div className={`analytics-modal ${isMounted ? 'loaded' : ''}`}>

        <div className="analytics-modal__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div>
              <h2 className="analytics-modal__title">Library Insights</h2>
              <p className="analytics-modal__subtitle">Analyzing {videos.length} videos</p>
            </div>
            {hasActiveFilters && (
              <button
                onClick={onResetFilters}
                className="analytics-card__badge"
                style={{ cursor: 'pointer', background: 'rgba(255, 45, 85, 0.15)', color: '#ff2d55', border: '1px solid rgba(255, 45, 85, 0.3)', padding: '6px 12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '600' }}
                title="Clear current drill-down filters"
              >
                Clear Filters
              </button>
            )}
          </div>
          <div className="analytics-modal__header-right">
            {/* Tab navigation */}
            <div className="analytics-tabs">
              <button
                className={`analytics-tab ${activeTab === 'overview' ? 'analytics-tab--active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button
                className={`analytics-tab ${activeTab === 'deepdive' ? 'analytics-tab--active' : ''}`}
                onClick={() => setActiveTab('deepdive')}
              >
                Deep Dive
              </button>
              <button
                className={`analytics-tab ${activeTab === 'collection' ? 'analytics-tab--active' : ''}`}
                onClick={() => setActiveTab('collection')}
              >
                Collection
              </button>
            </div>
            <button className="analytics-modal__close" onClick={onClose} title="Close Analytics">
              ✕
            </button>
          </div>
        </div>

        <div className="analytics-modal__body">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'deepdive' && renderDeepDive()}
          {activeTab === 'collection' && renderCollection()}
        </div>
      </div>
    </div>
  );
}

export default AnalyticsDashboard;
