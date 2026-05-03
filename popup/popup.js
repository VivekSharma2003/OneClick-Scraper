'use strict';

// ── DOM References ──
const btnScrape     = document.getElementById('btnScrape');
const btnJSON       = document.getElementById('btnJSON');
const btnZIP        = document.getElementById('btnZIP');
const statusChip    = document.getElementById('statusChip');
const statusDot     = document.getElementById('statusDot');
const statusText    = document.getElementById('statusText');
const statsPanel    = document.getElementById('statsPanel');
const statImages    = document.getElementById('statImages');
const statLinks     = document.getElementById('statLinks');
const statChars     = document.getElementById('statChars');
const pageTitle     = document.getElementById('pageTitle');
const pageTitleText = document.getElementById('pageTitleText');
const errorMessage  = document.getElementById('errorMessage');
const errorText     = document.getElementById('errorText');
const scrapeSpinner = document.getElementById('scrapeSpinner');
const btnLabel      = btnScrape.querySelector('.btn-label');
const btnIcon       = btnScrape.querySelector('.btn-icon');

let scrapedData = null;

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

function showStats(data) {
  statImages.textContent = formatNumber(data.images.length);
  statLinks.textContent  = formatNumber(data.links.length);
  statChars.textContent  = formatNumber(data.text.length);
  statsPanel.classList.remove('hidden');

  if (data.title) {
    pageTitleText.textContent = data.title;
    pageTitle.classList.remove('hidden');
  }
}

function toggleDownloads(enabled) {
  btnJSON.disabled = !enabled;
  btnZIP.disabled  = !enabled;
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

// ── Scrape ──

btnScrape.addEventListener('click', async () => {
  hideError();
  setStatus('scraping', 'Scraping\u2026');
  setScraping(true);
  toggleDownloads(false);
  statsPanel.classList.add('hidden');
  pageTitle.classList.add('hidden');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab found.');
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:'))) {
      throw new Error('Cannot scrape browser internal pages.');
    }

    const response = await chrome.runtime.sendMessage({ action: 'scrape', tabId: tab.id });

    if (response && response.error) throw new Error(response.error);
    if (!response || !response.data) throw new Error('No data returned from content script.');

    scrapedData = response.data;
    setStatus('done', 'Scrape complete');
    showStats(scrapedData);
    toggleDownloads(true);
  } catch (err) {
    console.error('Scrape error:', err);
    setStatus('error', 'Something went wrong');
    showError(err.message || 'An unknown error occurred.');
  } finally {
    setScraping(false);
  }
});

// ── Download JSON ──

btnJSON.addEventListener('click', () => {
  if (!scrapedData) return;
  chrome.runtime.sendMessage({ action: 'downloadJSON', data: scrapedData });
});

// ── Download ZIP ──

btnZIP.addEventListener('click', () => {
  if (!scrapedData) return;
  btnZIP.disabled = true;
  setStatus('scraping', 'Building ZIP\u2026');
  chrome.runtime.sendMessage({ action: 'downloadZIP', data: scrapedData }, (response) => {
    if (response && response.error) {
      showError(response.error);
      setStatus('error', 'ZIP failed');
    } else {
      setStatus('done', 'ZIP ready');
    }
    btnZIP.disabled = false;
  });
});
