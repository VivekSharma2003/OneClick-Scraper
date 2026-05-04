/**
 * OneClick Scraper — Background Service Worker
 * Handles communication between popup and content script,
 * manages JSON/ZIP download triggers.
 */
'use strict';

// Import JSZip library
importScripts('../lib/jszip.min.js');

// ── Message Handler ──────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scrape') {
    handleScrape(message.tabId).then(sendResponse).catch(err => {
      sendResponse({ error: err.message || 'Scrape failed.' });
    });
    return true; // Keep message channel open for async response
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
    return true; // Async
  }
});

// ── Scrape: Inject content script and retrieve data ──────────────────

async function handleScrape(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content/content.js']
    });

    // executeScript returns an array of InjectionResults
    if (!results || results.length === 0 || !results[0].result) {
      return { error: 'Content script returned no data.' };
    }

    return { data: results[0].result };
  } catch (err) {
    console.error('Injection error:', err);
    return { error: 'Failed to inject content script: ' + err.message };
  }
}

// ── Download JSON ────────────────────────────────────────────────────

function handleDownloadJSON(data) {
  const json = JSON.stringify(data, null, 2);
  // Service workers don't support URL.createObjectURL — use data URL instead
  const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
  const filename = sanitizeFilename(data.title || 'scraped-data') + '.json';

  chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: true
  });
}

// ── Download ZIP ─────────────────────────────────────────────────────

async function handleDownloadZIP(data) {
  const zip = new JSZip();

  // Add JSON data to zip
  zip.file('data.json', JSON.stringify(data, null, 2));

  // Download and add images
  if (data.images && data.images.length > 0) {
    const imgFolder = zip.folder('images');

    // Limit to 50 images to avoid performance issues
    const maxImages = Math.min(data.images.length, 50);
    const downloadPromises = [];

    for (let i = 0; i < maxImages; i++) {
      downloadPromises.push(
        fetchImageAsBlob(data.images[i], i)
      );
    }

    const results = await Promise.allSettled(downloadPromises);

    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        imgFolder.file(result.value.filename, result.value.blob);
      }
    });
  }

  // Generate ZIP as base64 — service workers don't support URL.createObjectURL
  const base64 = await zip.generateAsync({ type: 'base64' });
  const dataUrl = 'data:application/zip;base64,' + base64;
  const filename = sanitizeFilename(data.title || 'scraped-data') + '.zip';

  chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: true
  });
}

// ── Fetch an image and return it as a named blob ─────────────────────

async function fetchImageAsBlob(imageUrl, index) {
  try {
    const response = await fetch(imageUrl, {
      mode: 'cors',
      credentials: 'omit'
    });

    if (!response.ok) return null;

    const blob = await response.blob();
    const ext = guessExtension(imageUrl, response.headers.get('content-type'));
    const filename = 'image_' + (index + 1) + ext;

    return { filename, blob };
  } catch (err) {
    // Silently skip images that can't be fetched (CORS, etc.)
    console.warn('Could not fetch image:', imageUrl, err.message);
    return null;
  }
}

// ── Utilities ────────────────────────────────────────────────────────

/**
 * Guess file extension from URL path or content-type header.
 */
function guessExtension(url, contentType) {
  // Try URL path first
  try {
    var pathname = new URL(url).pathname;
    var match = pathname.match(/\.(jpe?g|png|gif|webp|svg|bmp|ico|avif|tiff?)(\?|$)/i);
    if (match) return '.' + match[1].toLowerCase();
  } catch (e) { /* ignore */ }

  // Fall back to content-type
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

  return '.jpg'; // Safe default
}

/**
 * Sanitize a string to be safe as a filename.
 */
function sanitizeFilename(name) {
  return name
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 60)
    .replace(/_+$/, '')
    || 'scraped-data';
}
