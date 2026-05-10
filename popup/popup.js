'use strict';

// ── DOM References ──
var btnScrape      = document.getElementById('btnScrape');
var btnJSON        = document.getElementById('btnJSON');
var btnZIP         = document.getElementById('btnZIP');
var btnCopy        = document.getElementById('btnCopy');
var btnCSVImages   = document.getElementById('btnCSVImages');
var btnCSVLinks    = document.getElementById('btnCSVLinks');
var btnHistory     = document.getElementById('btnHistory');
var btnCloseHist   = document.getElementById('btnCloseHistory');
var btnClearHist   = document.getElementById('btnClearHistory');
var statusChip     = document.getElementById('statusChip');
var statusText     = document.getElementById('statusText');
var statsPanel     = document.getElementById('statsPanel');
var statImages     = document.getElementById('statImages');
var statLinks      = document.getElementById('statLinks');
var statChars      = document.getElementById('statChars');
var statMeta       = document.getElementById('statMeta');
var pageTitle      = document.getElementById('pageTitle');
var pageTitleText  = document.getElementById('pageTitleText');
var errorMessage   = document.getElementById('errorMessage');
var errorText      = document.getElementById('errorText');
var scrapeSpinner  = document.getElementById('scrapeSpinner');
var btnLabel       = btnScrape.querySelector('.btn-label');
var btnIcon        = btnScrape.querySelector('.btn-icon');
var imagePreview   = document.getElementById('imagePreview');
var imageGrid      = document.getElementById('imageGrid');
var imageCount     = document.getElementById('imageCount');
var metaPreview    = document.getElementById('metaPreview');
var metaTags       = document.getElementById('metaTags');
var historyOverlay = document.getElementById('historyOverlay');
var historyList    = document.getElementById('historyList');
var historyEmpty   = document.getElementById('historyEmpty');
var toast          = document.getElementById('toast');
var toastText      = document.getElementById('toastText');

var scrapedData = null;

// ── Helpers ──

function setStatus(state, text) {
  statusChip.className = 'status-chip ' + state;
  statusText.textContent = text;
}

function showError(msg) {
  errorText.textContent = msg;
  errorMessage.classList.remove('hidden');
}

function hideError() {
  errorMessage.classList.add('hidden');
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function showToast(message) {
  toastText.textContent = message;
  toast.classList.remove('hidden');
  toast.classList.add('show');
  setTimeout(function () {
    toast.classList.remove('show');
    setTimeout(function () {
      toast.classList.add('hidden');
    }, 300);
  }, 2000);
}

function showStats(data) {
  statImages.textContent = formatNumber(data.images.length);
  statLinks.textContent  = formatNumber(data.links.length);
  statChars.textContent  = formatNumber(data.text.length);
  statMeta.textContent   = data.meta ? Object.keys(data.meta).length : 0;
  statsPanel.classList.remove('hidden');

  if (data.title) {
    pageTitleText.textContent = data.title;
    pageTitle.classList.remove('hidden');
  }
}

function toggleDownloads(enabled) {
  btnJSON.disabled      = !enabled;
  btnZIP.disabled       = !enabled;
  btnCopy.disabled      = !enabled;
  btnCSVImages.disabled = !enabled;
  btnCSVLinks.disabled  = !enabled;
}

function setScraping(active) {
  if (active) {
    scrapeSpinner.classList.remove('hidden');
    btnLabel.textContent = 'Scraping\u2026';
    btnIcon.style.display = 'none';
    btnScrape.disabled = true;
  } else {
    scrapeSpinner.classList.add('hidden');
    btnLabel.textContent = 'Scrape This Page';
    btnIcon.style.display = '';
    btnScrape.disabled = false;
  }
}

// ── Image Preview ──

function showImagePreview(images) {
  imageGrid.innerHTML = '';
  if (!images || images.length === 0) {
    imagePreview.classList.add('hidden');
    return;
  }

  var previewCount = Math.min(images.length, 12);
  imageCount.textContent = images.length + ' total';

  for (var i = 0; i < previewCount; i++) {
    var thumb = document.createElement('div');
    thumb.className = 'image-thumb';
    var img = document.createElement('img');
    img.src = images[i];
    img.alt = 'Image ' + (i + 1);
    img.loading = 'lazy';
    img.onerror = function () { this.parentElement.classList.add('broken'); };
    thumb.appendChild(img);
    imageGrid.appendChild(thumb);
  }

  if (images.length > previewCount) {
    var more = document.createElement('div');
    more.className = 'image-thumb more-indicator';
    more.textContent = '+' + (images.length - previewCount);
    imageGrid.appendChild(more);
  }

  imagePreview.classList.remove('hidden');
}

// ── Meta Preview ──

function showMetaPreview(meta) {
  metaTags.innerHTML = '';
  if (!meta || Object.keys(meta).length === 0) {
    metaPreview.classList.add('hidden');
    return;
  }

  var flatItems = [];

  if (meta.description) flatItems.push({ key: 'description', val: meta.description });
  if (meta.keywords) flatItems.push({ key: 'keywords', val: meta.keywords });
  if (meta.author) flatItems.push({ key: 'author', val: meta.author });
  if (meta.language) flatItems.push({ key: 'lang', val: meta.language });
  if (meta.canonical) flatItems.push({ key: 'canonical', val: meta.canonical });
  if (meta.favicon) flatItems.push({ key: 'favicon', val: meta.favicon });

  if (meta.og) {
    Object.keys(meta.og).forEach(function (k) {
      flatItems.push({ key: 'og:' + k, val: meta.og[k] });
    });
  }
  if (meta.twitter) {
    Object.keys(meta.twitter).forEach(function (k) {
      flatItems.push({ key: 'tw:' + k, val: meta.twitter[k] });
    });
  }

  // Show max 8 tags
  var showCount = Math.min(flatItems.length, 8);
  for (var i = 0; i < showCount; i++) {
    var tag = document.createElement('div');
    tag.className = 'meta-tag';

    var keySpan = document.createElement('span');
    keySpan.className = 'meta-key';
    keySpan.textContent = flatItems[i].key;

    var valSpan = document.createElement('span');
    valSpan.className = 'meta-val';
    valSpan.textContent = flatItems[i].val;

    tag.appendChild(keySpan);
    tag.appendChild(valSpan);
    metaTags.appendChild(tag);
  }

  metaPreview.classList.remove('hidden');
}

// ── History Panel ──

function openHistory() {
  historyOverlay.classList.remove('hidden');
  loadHistory();
}

function closeHistory() {
  historyOverlay.classList.add('hidden');
}

function loadHistory() {
  chrome.runtime.sendMessage({ action: 'getHistory' }, function (response) {
    var history = (response && response.history) || [];
    renderHistory(history);
  });
}

function renderHistory(history) {
  // Remove old items but keep the empty state element
  var items = historyList.querySelectorAll('.history-item');
  items.forEach(function (el) { el.remove(); });

  if (history.length === 0) {
    historyEmpty.style.display = '';
    return;
  }

  historyEmpty.style.display = 'none';

  history.forEach(function (entry) {
    var item = document.createElement('div');
    item.className = 'history-item';

    var title = document.createElement('div');
    title.className = 'history-item-title';
    title.textContent = entry.title || 'Untitled';

    var url = document.createElement('div');
    url.className = 'history-item-url';
    url.textContent = entry.url;

    var stats = document.createElement('div');
    stats.className = 'history-item-stats';
    stats.textContent = entry.images + ' imgs \u00B7 ' + entry.links + ' links \u00B7 ' + formatNumber(entry.textLength) + ' chars';

    var time = document.createElement('div');
    time.className = 'history-item-time';
    time.textContent = formatTimeAgo(entry.scrapedAt);

    item.appendChild(title);
    item.appendChild(url);
    item.appendChild(stats);
    item.appendChild(time);
    historyList.appendChild(item);
  });
}

function formatTimeAgo(isoString) {
  var date = new Date(isoString);
  var now = new Date();
  var diffMs = now - date;
  var diffMins = Math.floor(diffMs / 60000);
  var diffHours = Math.floor(diffMs / 3600000);
  var diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return diffMins + 'm ago';
  if (diffHours < 24) return diffHours + 'h ago';
  if (diffDays < 7) return diffDays + 'd ago';
  return date.toLocaleDateString();
}

// ── Event Listeners ──

// Scrape
btnScrape.addEventListener('click', async function () {
  hideError();
  setStatus('scraping', 'Scraping\u2026');
  setScraping(true);
  toggleDownloads(false);
  statsPanel.classList.add('hidden');
  pageTitle.classList.add('hidden');
  imagePreview.classList.add('hidden');
  metaPreview.classList.add('hidden');

  try {
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    var tab = tabs[0];
    if (!tab || !tab.id) throw new Error('No active tab found.');
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:'))) {
      throw new Error('Cannot scrape browser internal pages.');
    }

    var response = await chrome.runtime.sendMessage({ action: 'scrape', tabId: tab.id });

    if (response && response.error) throw new Error(response.error);
    if (!response || !response.data) throw new Error('No data returned.');

    scrapedData = response.data;
    setStatus('done', 'Scrape complete');
    showStats(scrapedData);
    showImagePreview(scrapedData.images);
    showMetaPreview(scrapedData.meta);
    toggleDownloads(true);

    // Save to history
    chrome.runtime.sendMessage({ action: 'saveHistory', data: scrapedData });

  } catch (err) {
    console.error('Scrape error:', err);
    setStatus('error', 'Something went wrong');
    showError(err.message || 'An unknown error occurred.');
  } finally {
    setScraping(false);
  }
});

// Download JSON
btnJSON.addEventListener('click', function () {
  if (!scrapedData) return;
  chrome.runtime.sendMessage({ action: 'downloadJSON', data: scrapedData });
  showToast('JSON download started');
});

// Download ZIP
btnZIP.addEventListener('click', function () {
  if (!scrapedData) return;
  btnZIP.disabled = true;
  setStatus('scraping', 'Building ZIP\u2026');
  chrome.runtime.sendMessage({ action: 'downloadZIP', data: scrapedData }, function (response) {
    if (response && response.error) {
      showError(response.error);
      setStatus('error', 'ZIP failed');
    } else {
      setStatus('done', 'ZIP ready');
      showToast('ZIP download started');
    }
    btnZIP.disabled = false;
  });
});

// Copy to clipboard
btnCopy.addEventListener('click', function () {
  if (!scrapedData) return;
  var json = JSON.stringify(scrapedData, null, 2);
  navigator.clipboard.writeText(json).then(function () {
    showToast('JSON copied to clipboard');
  }).catch(function () {
    // Fallback for older browsers
    var ta = document.createElement('textarea');
    ta.value = json;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('JSON copied to clipboard');
  });
});

// CSV exports
btnCSVImages.addEventListener('click', function () {
  if (!scrapedData) return;
  chrome.runtime.sendMessage({ action: 'downloadCSV', data: scrapedData, csvType: 'images' });
  showToast('Images CSV download started');
});

btnCSVLinks.addEventListener('click', function () {
  if (!scrapedData) return;
  chrome.runtime.sendMessage({ action: 'downloadCSV', data: scrapedData, csvType: 'links' });
  showToast('Links CSV download started');
});

// History
btnHistory.addEventListener('click', openHistory);
btnCloseHist.addEventListener('click', closeHistory);

btnClearHist.addEventListener('click', function () {
  chrome.runtime.sendMessage({ action: 'clearHistory' }, function () {
    loadHistory();
    showToast('History cleared');
  });
});

// Close history on overlay click
historyOverlay.addEventListener('click', function (e) {
  if (e.target === historyOverlay) closeHistory();
});
