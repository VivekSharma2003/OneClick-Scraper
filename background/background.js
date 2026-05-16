/**
 * OneClick Scraper — Background Service Worker
 * Handles scraping orchestration, downloads (JSON/ZIP/CSV), and scrape history.
 */
'use strict';

importScripts('../lib/jszip.min.js');

// ── Message Handler ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scrape') {
    handleScrape(message.tabId).then(sendResponse).catch(err => {
      sendResponse({ error: err.message || 'Scrape failed.' });
    });
    return true;
  }

  if (message.action === 'downloadJSON') {
    handleDownloadJSON(message.data);
    sendResponse({ success: true });
    return false;
  }

  if (message.action === 'downloadZIP') {
    handleDownloadZIP(message.data).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      sendResponse({ error: err.message || 'ZIP generation failed.' });
    });
    return true;
  }

  if (message.action === 'downloadCSV') {
    handleDownloadCSV(message.data, message.csvType);
    sendResponse({ success: true });
    return false;
  }

  if (message.action === 'saveHistory') {
    saveToHistory(message.data).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.action === 'getHistory') {
    getHistory().then(history => {
      sendResponse({ history: history });
    });
    return true;
  }

  if (message.action === 'clearHistory') {
    chrome.storage.local.set({ scrapeHistory: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === 'screenshot') {
    handleScreenshot().then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      sendResponse({ error: err.message || 'Screenshot failed.' });
    });
    return true;
  }

  if (message.action === 'downloadMarkdown') {
    handleDownloadMarkdown(message.data);
    sendResponse({ success: true });
    return false;
  }
});

// ── Scrape ──

async function handleScrape(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content/content.js']
    });

    if (!results || results.length === 0 || !results[0].result) {
      return { error: 'Content script returned no data.' };
    }

    return { data: results[0].result };
  } catch (err) {
    console.error('Injection error:', err);
    return { error: 'Failed to inject content script: ' + err.message };
  }
}

// ── Download JSON ──

function handleDownloadJSON(data) {
  var json = JSON.stringify(data, null, 2);
  var dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
  var filename = sanitizeFilename(data.title || 'scraped-data') + '.json';

  chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: true
  });
}

// ── Download ZIP ──

async function handleDownloadZIP(data) {
  var zip = new JSZip();
  zip.file('data.json', JSON.stringify(data, null, 2));

  if (data.images && data.images.length > 0) {
    var imgFolder = zip.folder('images');
    var maxImages = Math.min(data.images.length, 50);
    var downloadPromises = [];

    for (var i = 0; i < maxImages; i++) {
      downloadPromises.push(fetchImageAsBlob(data.images[i], i));
    }

    var results = await Promise.allSettled(downloadPromises);
    results.forEach(function (result) {
      if (result.status === 'fulfilled' && result.value) {
        imgFolder.file(result.value.filename, result.value.blob);
      }
    });
  }

  var base64 = await zip.generateAsync({ type: 'base64' });
  var dataUrl = 'data:application/zip;base64,' + base64;
  var filename = sanitizeFilename(data.title || 'scraped-data') + '.zip';

  chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: true
  });
}

// ── Download CSV ──

function handleDownloadCSV(data, csvType) {
  var csv = '', filename = '', base = sanitizeFilename(data.title || 'scraped-data');
  if (csvType === 'images') {
    csv = 'Index,Image URL\n';
    data.images.forEach(function(u,i) { csv += (i+1)+',"'+u.replace(/"/g,'""')+'"\n'; });
    filename = base + '_images.csv';
  } else if (csvType === 'links') {
    csv = 'Index,Link URL\n';
    data.links.forEach(function(u,i) { csv += (i+1)+',"'+u.replace(/"/g,'""')+'"\n'; });
    filename = base + '_links.csv';
  } else if (csvType === 'emails') {
    csv = 'Index,Email\n';
    (data.emails||[]).forEach(function(e,i) { csv += (i+1)+',"'+e.replace(/"/g,'""')+'"\n'; });
    filename = base + '_emails.csv';
  } else if (csvType === 'phones') {
    csv = 'Index,Phone\n';
    (data.phones||[]).forEach(function(p,i) { csv += (i+1)+',"'+p.replace(/"/g,'""')+'"\n'; });
    filename = base + '_phones.csv';
  }
  chrome.downloads.download({ url: 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv), filename: filename, saveAs: true });
}

// ── Screenshot ──

async function handleScreenshot() {
  var tabs = await chrome.tabs.query({active:true,currentWindow:true});
  var tab = tabs[0];
  if (!tab) throw new Error('No active tab.');
  var dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {format:'png'});
  var filename = 'screenshot_' + Date.now() + '.png';
  chrome.downloads.download({ url: dataUrl, filename: filename, saveAs: true });
}

// ── Download Markdown ──

function handleDownloadMarkdown(data) {
  var md = '# ' + (data.title || 'Untitled Page') + '\n\n';
  md += '**URL:** ' + data.url + '  \n';
  md += '**Scraped:** ' + data.scrapedAt + '  \n';
  md += '**Words:** ' + (data.wordCount || 0) + ' | **Reading Time:** ~' + (data.readingTimeMin || 1) + ' min\n\n';
  md += '---\n\n';
  if (data.technologies && data.technologies.length > 0) {
    md += '## Technologies\n\n' + data.technologies.map(function(t) { return '`' + t + '`'; }).join(' ') + '\n\n';
  }
  if (data.meta) {
    md += '## Meta Tags\n\n';
    if (data.meta.description) md += '- **Description:** ' + data.meta.description + '\n';
    if (data.meta.keywords) md += '- **Keywords:** ' + data.meta.keywords + '\n';
    if (data.meta.author) md += '- **Author:** ' + data.meta.author + '\n';
    if (data.meta.canonical) md += '- **Canonical:** ' + data.meta.canonical + '\n';
    md += '\n';
  }
  if (data.headings && data.headings.length > 0) {
    md += '## Headings Structure\n\n';
    data.headings.forEach(function(h) { md += '  '.repeat(h.level - 1) + '- **H' + h.level + ':** ' + h.text + '\n'; });
    md += '\n';
  }
  if (data.images && data.images.length > 0) {
    md += '## Images (' + data.images.length + ')\n\n';
    data.images.forEach(function(u, i) { md += (i + 1) + '. ' + u + '\n'; });
    md += '\n';
  }
  if (data.links && data.links.length > 0) {
    md += '## Links (' + data.links.length + ')\n\n';
    data.links.forEach(function(u, i) { md += (i + 1) + '. ' + u + '\n'; });
    md += '\n';
  }
  if (data.emails && data.emails.length > 0) {
    md += '## Emails\n\n';
    data.emails.forEach(function(e) { md += '- ' + e + '\n'; });
    md += '\n';
  }
  if (data.phones && data.phones.length > 0) {
    md += '## Phone Numbers\n\n';
    data.phones.forEach(function(p) { md += '- ' + p + '\n'; });
    md += '\n';
  }
  if (data.fonts && data.fonts.length > 0) {
    md += '## Fonts\n\n' + data.fonts.map(function(f) { return '`' + f + '`'; }).join(' ') + '\n\n';
  }
  if (data.text) {
    md += '## Content\n\n' + data.text.substring(0, 10000) + '\n';
  }

  var dataUrl = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(md);
  var filename = sanitizeFilename(data.title || 'scraped-data') + '.md';
  chrome.downloads.download({ url: dataUrl, filename: filename, saveAs: true });
}

// ── Scrape History ──

async function saveToHistory(data) {
  var history = await getHistory();
  var entry = {
    url: data.url,
    title: data.title,
    images: data.images.length,
    links: data.links.length,
    textLength: data.text.length,
    metaKeys: data.meta ? Object.keys(data.meta).length : 0,
    scrapedAt: data.scrapedAt || new Date().toISOString()
  };

  history.unshift(entry);
  // Keep only last 15 entries
  if (history.length > 15) {
    history = history.slice(0, 15);
  }

  return new Promise(function (resolve) {
    chrome.storage.local.set({ scrapeHistory: history }, resolve);
  });
}

function getHistory() {
  return new Promise(function (resolve) {
    chrome.storage.local.get({ scrapeHistory: [] }, function (result) {
      resolve(result.scrapeHistory || []);
    });
  });
}

// ── Utilities ──

async function fetchImageAsBlob(imageUrl, index) {
  try {
    var response = await fetch(imageUrl, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) return null;
    var blob = await response.blob();
    var ext = guessExtension(imageUrl, response.headers.get('content-type'));
    return { filename: 'image_' + (index + 1) + ext, blob: blob };
  } catch (err) {
    console.warn('Could not fetch image:', imageUrl, err.message);
    return null;
  }
}

function guessExtension(url, contentType) {
  try {
    var pathname = new URL(url).pathname;
    var match = pathname.match(/\.(jpe?g|png|gif|webp|svg|bmp|ico|avif|tiff?)(\?|$)/i);
    if (match) return '.' + match[1].toLowerCase();
  } catch (e) { /* ignore */ }

  if (contentType) {
    var ct = contentType.toLowerCase();
    if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg';
    if (ct.includes('png'))  return '.png';
    if (ct.includes('gif'))  return '.gif';
    if (ct.includes('webp')) return '.webp';
    if (ct.includes('svg'))  return '.svg';
    if (ct.includes('avif')) return '.avif';
    if (ct.includes('bmp'))  return '.bmp';
    if (ct.includes('ico'))  return '.ico';
  }

  return '.jpg';
}

function sanitizeFilename(name) {
  return name
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 60)
    .replace(/_+$/, '')
    || 'scraped-data';
}
