(function () {
  'use strict';

  const socket = io();
  let currentSource = 'all';
  let currentPage = 1;
  const PAGE_SIZE = 50;

  // Elements
  const trendsList = document.getElementById('trendsList');
  const sourceFilters = document.getElementById('sourceFilters');
  const refreshBtn = document.getElementById('refreshBtn');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const statusEl = document.getElementById('status');
  const paginationEl = document.getElementById('pagination');
  const fetchStatusEl = document.getElementById('fetchStatus');
  const analysisPanel = document.getElementById('analysisPanel');
  const analysisSummary = document.getElementById('analysisSummary');
  const analysisTopics = document.getElementById('analysisTopics');
  const analysisTime = document.getElementById('analysisTime');

  // === Load data ===
  async function loadTrends() {
    const params = new URLSearchParams({
      page: String(currentPage),
      limit: String(PAGE_SIZE),
    });
    if (currentSource !== 'all') {
      params.set('source', currentSource);
    }

    trendsList.innerHTML = '<div class="loading">加载中...</div>';

    try {
      const res = await fetch('/api/trends?' + params.toString());
      const data = await res.json();
      renderTrends(data.items);
      renderPagination(data.pagination);
    } catch (err) {
      trendsList.innerHTML = '<div class="loading">加载失败，请刷新重试</div>';
    }
  }

  async function loadSources() {
    try {
      const res = await fetch('/api/trends/sources');
      const data = await res.json();
      renderSourceFilters(data.sources);
    } catch {
      // Keep default "all" filter
    }
  }

  async function loadAnalysis() {
    try {
      const res = await fetch('/api/trends/analysis');
      const data = await res.json();
      if (data.analysis) {
        renderAnalysis(data.analysis);
      }
      // Hide analyze button if not configured
      if (!data.configured) {
        analyzeBtn.style.display = 'none';
      }
    } catch {}
  }

  // === Render ===
  function renderTrends(items) {
    if (!items || items.length === 0) {
      trendsList.innerHTML = '<div class="loading">暂无数据，等待首次采集...</div>';
      return;
    }

    trendsList.innerHTML = items.map(function (item) {
      var extra = {};
      try { extra = JSON.parse(item.extra || '{}'); } catch {}

      var titleHtml = item.url
        ? '<a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener">' + escapeHtml(item.title) + '</a>'
        : escapeHtml(item.title);

      var metaParts = [];
      if (item.score > 0) metaParts.push('<span class="score">🔥 ' + formatScore(item.score) + '</span>');
      if (extra.num_comments) metaParts.push('💬 ' + formatScore(extra.num_comments));
      if (extra.subreddit) metaParts.push('r/' + escapeHtml(extra.subreddit));
      if (extra.author) metaParts.push('@' + escapeHtml(extra.author));
      if (extra.comments) metaParts.push('💬 ' + formatScore(extra.comments));
      metaParts.push(timeAgo(item.fetchedAt));

      return '<div class="trend-card">'
        + '<div class="header">'
        + '<div class="title">' + titleHtml + '</div>'
        + '<span class="source-badge ' + escapeHtml(item.source) + '">' + escapeHtml(item.source) + '</span>'
        + '</div>'
        + '<div class="meta">' + metaParts.join(' · ') + '</div>'
        + '</div>';
    }).join('');
  }

  function renderSourceFilters(sources) {
    var html = '<button class="filter-btn ' + (currentSource === 'all' ? 'active' : '') + '" data-source="all">全部</button>';
    var labels = { google: 'Google', reddit: 'Reddit', hackernews: 'HN', duckduckgo: 'DDG', twitter: 'Twitter' };
    sources.forEach(function (s) {
      html += '<button class="filter-btn ' + (currentSource === s ? 'active' : '') + '" data-source="' + s + '">'
        + (labels[s] || s) + '</button>';
    });
    sourceFilters.innerHTML = html;
  }

  function renderPagination(pagination) {
    if (!pagination || pagination.totalPages <= 1) {
      paginationEl.innerHTML = '';
      return;
    }

    var html = '';
    html += '<button ' + (currentPage <= 1 ? 'disabled' : '') + ' data-page="' + (currentPage - 1) + '">上一页</button>';
    html += '<button disabled>第 ' + currentPage + ' / ' + pagination.totalPages + ' 页</button>';
    html += '<button ' + (currentPage >= pagination.totalPages ? 'disabled' : '') + ' data-page="' + (currentPage + 1) + '">下一页</button>';
    paginationEl.innerHTML = html;
  }

  // === Events ===
  sourceFilters.addEventListener('click', function (e) {
    if (e.target.classList.contains('filter-btn')) {
      currentSource = e.target.dataset.source;
      currentPage = 1;
      loadTrends();
      loadSources();
    }
  });

  paginationEl.addEventListener('click', function (e) {
    if (e.target.tagName === 'BUTTON' && e.target.dataset.page) {
      currentPage = parseInt(e.target.dataset.page);
      loadTrends();
    }
  });

  refreshBtn.addEventListener('click', async function () {
    refreshBtn.disabled = true;
    statusEl.textContent = '采集中...';
    try {
      await fetch('/api/trends/refresh', { method: 'POST' });
    } catch {}
    setTimeout(function () {
      refreshBtn.disabled = false;
    }, 5000);
  });

  analyzeBtn.addEventListener('click', async function () {
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'AI 分析中...';
    try {
      await fetch('/api/trends/analyze', { method: 'POST' });
    } catch {}
    setTimeout(function () {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'AI 分析';
    }, 10000);
  });

  // === Socket.IO ===
  socket.on('connect', function () {
    statusEl.textContent = '🟢 已连接';
  });

  socket.on('disconnect', function () {
    statusEl.textContent = '🔴 断开连接';
  });

  socket.on('new-trends', function (data) {
    statusEl.textContent = '✅ 新数据 ' + data.items.length + ' 条 - ' + new Date(data.timestamp).toLocaleTimeString();
    // Reload current view
    loadTrends();
    loadSources();
  });

  socket.on('fetch-status', function (data) {
    var html = '';
    data.results.forEach(function (r) {
      var cls = r.error ? 'error' : 'success';
      var msg = r.error ? '失败' : r.count + ' 条';
      html += '<div class="fetch-toast"><span class="source-name">' + escapeHtml(r.source) + '</span>: '
        + '<span class="' + cls + '">' + msg + '</span></div>';
    });
    fetchStatusEl.innerHTML = html;
    refreshBtn.disabled = false;

    // Auto-hide after 5s
    setTimeout(function () {
      fetchStatusEl.innerHTML = '';
    }, 5000);
  });

  socket.on('analysis-update', function (data) {
    if (data.analysis) {
      renderAnalysis(data.analysis);
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'AI 分析';
    }
  });

  // === Render Analysis ===
  function renderAnalysis(data) {
    analysisPanel.style.display = 'block';
    analysisSummary.textContent = data.summary || '';
    if (data.createdAt) {
      analysisTime.textContent = timeAgo(data.createdAt);
    }

    var topics = data.topics || [];
    analysisTopics.innerHTML = topics.map(function (t) {
      var heat = t.heat || 'medium';
      var sources = (t.sources || []).join(', ');
      return '<span class="topic-tag ' + heat + '" title="' + escapeHtml(t.description || '') + ' (' + escapeHtml(sources) + ')">'
        + '<span class="heat-dot"></span>'
        + escapeHtml(t.name)
        + '</span>';
    }).join('');
  }

  // === Utils ===
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatScore(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  function timeAgo(dateStr) {
    var d = new Date(dateStr);
    var diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
    return Math.floor(diff / 86400) + '天前';
  }

  // === Init ===
  loadTrends();
  loadSources();
  loadAnalysis();
})();
