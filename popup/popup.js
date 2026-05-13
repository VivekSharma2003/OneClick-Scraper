'use strict';

var btnScrape = document.getElementById('btnScrape');
var btnJSON = document.getElementById('btnJSON');
var btnZIP = document.getElementById('btnZIP');
var btnCopy = document.getElementById('btnCopy');
var btnCSVImages = document.getElementById('btnCSVImages');
var btnCSVLinks = document.getElementById('btnCSVLinks');
var btnCSVEmails = document.getElementById('btnCSVEmails');
var btnCSVPhones = document.getElementById('btnCSVPhones');
var btnScreenshot = document.getElementById('btnScreenshot');
var btnHistory = document.getElementById('btnHistory');
var btnCloseHist = document.getElementById('btnCloseHistory');
var btnClearHist = document.getElementById('btnClearHistory');
var statusChip = document.getElementById('statusChip');
var statusText = document.getElementById('statusText');
var statsPanel = document.getElementById('statsPanel');
var statImages = document.getElementById('statImages');
var statLinks = document.getElementById('statLinks');
var statChars = document.getElementById('statChars');
var statReadTime = document.getElementById('statReadTime');
var pageTitle = document.getElementById('pageTitle');
var pageTitleText = document.getElementById('pageTitleText');
var errorMessage = document.getElementById('errorMessage');
var errorText = document.getElementById('errorText');
var scrapeSpinner = document.getElementById('scrapeSpinner');
var btnLabel = btnScrape.querySelector('.btn-label');
var btnIcon = btnScrape.querySelector('.btn-icon');
var imagePreview = document.getElementById('imagePreview');
var imageGrid = document.getElementById('imageGrid');
var imageCount = document.getElementById('imageCount');
var metaPreview = document.getElementById('metaPreview');
var metaTags = document.getElementById('metaTags');
var contactsSection = document.getElementById('contactsSection');
var contactsGrid = document.getElementById('contactsGrid');
var contactCount = document.getElementById('contactCount');
var socialSection = document.getElementById('socialSection');
var socialChips = document.getElementById('socialChips');
var headingsSection = document.getElementById('headingsSection');
var headingsList = document.getElementById('headingsList');
var headingsCount = document.getElementById('headingsCount');
var historyOverlay = document.getElementById('historyOverlay');
var historyList = document.getElementById('historyList');
var historyEmpty = document.getElementById('historyEmpty');
var toast = document.getElementById('toast');
var toastText = document.getElementById('toastText');

var scrapedData = null;

function setStatus(s, t) { statusChip.className = 'status-chip ' + s; statusText.textContent = t; }
function showError(m) { errorText.textContent = m; errorMessage.classList.remove('hidden'); }
function hideError() { errorMessage.classList.add('hidden'); }
function fmt(n) { return n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : String(n); }

function showToast(msg) {
  toastText.textContent = msg;
  toast.classList.remove('hidden'); toast.classList.add('show');
  setTimeout(function() { toast.classList.remove('show'); setTimeout(function() { toast.classList.add('hidden'); }, 300); }, 2000);
}

function showStats(d) {
  statImages.textContent = fmt(d.images.length);
  statLinks.textContent = fmt(d.links.length);
  statChars.textContent = fmt(d.wordCount || 0);
  statReadTime.textContent = d.readingTimeMin || 1;
  statsPanel.classList.remove('hidden');
  if (d.title) { pageTitleText.textContent = d.title; pageTitle.classList.remove('hidden'); }
}

function toggleDownloads(on) {
  [btnJSON, btnZIP, btnCopy, btnCSVImages, btnCSVLinks, btnScreenshot].forEach(function(b) { b.disabled = !on; });
  btnCSVEmails.disabled = !(on && scrapedData && scrapedData.emails && scrapedData.emails.length > 0);
  btnCSVPhones.disabled = !(on && scrapedData && scrapedData.phones && scrapedData.phones.length > 0);
}

function setScraping(active) {
  if (active) { scrapeSpinner.classList.remove('hidden'); btnLabel.textContent = 'Scraping\u2026'; btnIcon.style.display = 'none'; btnScrape.disabled = true; }
  else { scrapeSpinner.classList.add('hidden'); btnLabel.textContent = 'Scrape This Page'; btnIcon.style.display = ''; btnScrape.disabled = false; }
}

// ── Contacts (Emails + Phones) ──
function showContacts(emails, phones) {
  contactsGrid.innerHTML = '';
  var total = (emails ? emails.length : 0) + (phones ? phones.length : 0);
  if (total === 0) { contactsSection.classList.add('hidden'); return; }
  contactCount.textContent = total + ' found';
  var max = 8;
  (emails || []).slice(0, max).forEach(function(e) {
    var chip = document.createElement('div'); chip.className = 'contact-chip email';
    chip.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>';
    var span = document.createElement('span'); span.textContent = e; chip.appendChild(span);
    chip.title = e;
    chip.addEventListener('click', function() { navigator.clipboard.writeText(e); showToast('Copied: ' + e); });
    contactsGrid.appendChild(chip);
  });
  (phones || []).slice(0, max).forEach(function(p) {
    var chip = document.createElement('div'); chip.className = 'contact-chip phone';
    chip.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>';
    var span = document.createElement('span'); span.textContent = p; chip.appendChild(span);
    chip.title = p;
    chip.addEventListener('click', function() { navigator.clipboard.writeText(p); showToast('Copied: ' + p); });
    contactsGrid.appendChild(chip);
  });
  contactsSection.classList.remove('hidden');
}

// ── Social Links ──
var socialIcons = { twitter:'𝕏', facebook:'f', instagram:'📷', youtube:'▶', linkedin:'in', github:'⌨', tiktok:'♪', pinterest:'📌', reddit:'r', discord:'💬' };
function showSocial(social) {
  socialChips.innerHTML = '';
  if (!social || Object.keys(social).length === 0) { socialSection.classList.add('hidden'); return; }
  Object.keys(social).forEach(function(platform) {
    var chip = document.createElement('div'); chip.className = 'social-chip';
    var icon = document.createElement('span'); icon.className = 'social-icon'; icon.textContent = socialIcons[platform] || '🔗';
    var name = document.createElement('span'); name.className = 'social-name'; name.textContent = platform;
    var count = document.createElement('span'); count.className = 'social-badge'; count.textContent = social[platform].length;
    chip.appendChild(icon); chip.appendChild(name); chip.appendChild(count);
    socialChips.appendChild(chip);
  });
  socialSection.classList.remove('hidden');
}

// ── Headings ──
function showHeadings(headings) {
  headingsList.innerHTML = '';
  if (!headings || headings.length === 0) { headingsSection.classList.add('hidden'); return; }
  headingsCount.textContent = headings.length + ' total';
  var max = 15;
  headings.slice(0, max).forEach(function(h) {
    var row = document.createElement('div'); row.className = 'heading-row level-' + h.level;
    var badge = document.createElement('span'); badge.className = 'heading-badge'; badge.textContent = 'H' + h.level;
    var text = document.createElement('span'); text.className = 'heading-text'; text.textContent = h.text;
    row.appendChild(badge); row.appendChild(text);
    headingsList.appendChild(row);
  });
  if (headings.length > max) {
    var more = document.createElement('div'); more.className = 'heading-row more';
    more.textContent = '+' + (headings.length - max) + ' more';
    headingsList.appendChild(more);
  }
  headingsSection.classList.remove('hidden');
}

// ── Image Preview ──
function showImagePreview(images) {
  imageGrid.innerHTML = '';
  if (!images || images.length === 0) { imagePreview.classList.add('hidden'); return; }
  var pc = Math.min(images.length, 12);
  imageCount.textContent = images.length + ' total';
  for (var i = 0; i < pc; i++) {
    var t = document.createElement('div'); t.className = 'image-thumb';
    var img = document.createElement('img'); img.src = images[i]; img.alt = 'Image ' + (i+1); img.loading = 'lazy';
    img.onerror = function() { this.parentElement.classList.add('broken'); };
    t.appendChild(img); imageGrid.appendChild(t);
  }
  if (images.length > pc) { var m = document.createElement('div'); m.className = 'image-thumb more-indicator'; m.textContent = '+' + (images.length - pc); imageGrid.appendChild(m); }
  imagePreview.classList.remove('hidden');
}

// ── Meta Preview ──
function showMetaPreview(meta) {
  metaTags.innerHTML = '';
  if (!meta || Object.keys(meta).length === 0) { metaPreview.classList.add('hidden'); return; }
  var items = [];
  if (meta.description) items.push({k:'description',v:meta.description});
  if (meta.keywords) items.push({k:'keywords',v:meta.keywords});
  if (meta.author) items.push({k:'author',v:meta.author});
  if (meta.language) items.push({k:'lang',v:meta.language});
  if (meta.canonical) items.push({k:'canonical',v:meta.canonical});
  if (meta.og) Object.keys(meta.og).forEach(function(k) { items.push({k:'og:'+k,v:meta.og[k]}); });
  if (meta.twitter) Object.keys(meta.twitter).forEach(function(k) { items.push({k:'tw:'+k,v:meta.twitter[k]}); });
  items.slice(0, 8).forEach(function(it) {
    var tag = document.createElement('div'); tag.className = 'meta-tag';
    var ks = document.createElement('span'); ks.className = 'meta-key'; ks.textContent = it.k;
    var vs = document.createElement('span'); vs.className = 'meta-val'; vs.textContent = it.v;
    tag.appendChild(ks); tag.appendChild(vs); metaTags.appendChild(tag);
  });
  metaPreview.classList.remove('hidden');
}

// ── History ──
function openHistory() { historyOverlay.classList.remove('hidden'); loadHistory(); }
function closeHistory() { historyOverlay.classList.add('hidden'); }
function loadHistory() { chrome.runtime.sendMessage({action:'getHistory'}, function(r) { renderHistory((r&&r.history)||[]); }); }
function renderHistory(h) {
  historyList.querySelectorAll('.history-item').forEach(function(el) { el.remove(); });
  if (h.length === 0) { historyEmpty.style.display = ''; return; }
  historyEmpty.style.display = 'none';
  h.forEach(function(e) {
    var item = document.createElement('div'); item.className = 'history-item';
    item.innerHTML = '<div class="history-item-title">' + (e.title||'Untitled').replace(/</g,'&lt;') + '</div><div class="history-item-url">' + (e.url||'').replace(/</g,'&lt;') + '</div><div class="history-item-stats">' + e.images + ' imgs \u00B7 ' + e.links + ' links \u00B7 ' + fmt(e.textLength) + ' chars</div><div class="history-item-time">' + fmtTime(e.scrapedAt) + '</div>';
    historyList.appendChild(item);
  });
}
function fmtTime(iso) {
  var d = new Date(iso), diff = Date.now() - d.getTime(), m = Math.floor(diff/6e4), h = Math.floor(diff/36e5), dy = Math.floor(diff/864e5);
  if (m < 1) return 'Just now'; if (m < 60) return m+'m ago'; if (h < 24) return h+'h ago'; if (dy < 7) return dy+'d ago'; return d.toLocaleDateString();
}

// ── EVENTS ──

btnScrape.addEventListener('click', async function() {
  hideError(); setStatus('scraping','Scraping\u2026'); setScraping(true); toggleDownloads(false);
  [statsPanel,pageTitle,imagePreview,metaPreview,contactsSection,socialSection,headingsSection].forEach(function(el) { el.classList.add('hidden'); });
  try {
    var tabs = await chrome.tabs.query({active:true,currentWindow:true}); var tab = tabs[0];
    if (!tab||!tab.id) throw new Error('No active tab found.');
    if (tab.url&&(tab.url.startsWith('chrome://')||tab.url.startsWith('chrome-extension://')||tab.url.startsWith('about:'))) throw new Error('Cannot scrape internal pages.');
    var r = await chrome.runtime.sendMessage({action:'scrape',tabId:tab.id});
    if (r&&r.error) throw new Error(r.error);
    if (!r||!r.data) throw new Error('No data returned.');
    scrapedData = r.data;
    setStatus('done','Scrape complete');
    showStats(scrapedData); showImagePreview(scrapedData.images); showMetaPreview(scrapedData.meta);
    showContacts(scrapedData.emails, scrapedData.phones); showSocial(scrapedData.socialLinks); showHeadings(scrapedData.headings);
    toggleDownloads(true);
    chrome.runtime.sendMessage({action:'saveHistory',data:scrapedData});
  } catch(err) { console.error(err); setStatus('error','Something went wrong'); showError(err.message||'Unknown error'); } finally { setScraping(false); }
});

btnJSON.addEventListener('click', function() { if (!scrapedData) return; chrome.runtime.sendMessage({action:'downloadJSON',data:scrapedData}); showToast('JSON download started'); });

btnZIP.addEventListener('click', function() {
  if (!scrapedData) return; btnZIP.disabled = true; setStatus('scraping','Building ZIP\u2026');
  chrome.runtime.sendMessage({action:'downloadZIP',data:scrapedData}, function(r) {
    if (r&&r.error) { showError(r.error); setStatus('error','ZIP failed'); } else { setStatus('done','ZIP ready'); showToast('ZIP download started'); }
    btnZIP.disabled = false;
  });
});

btnCopy.addEventListener('click', function() {
  if (!scrapedData) return;
  navigator.clipboard.writeText(JSON.stringify(scrapedData,null,2)).then(function() { showToast('JSON copied to clipboard'); }).catch(function() {
    var ta = document.createElement('textarea'); ta.value = JSON.stringify(scrapedData,null,2); ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast('JSON copied');
  });
});

btnCSVImages.addEventListener('click', function() { if (!scrapedData) return; chrome.runtime.sendMessage({action:'downloadCSV',data:scrapedData,csvType:'images'}); showToast('Images CSV started'); });
btnCSVLinks.addEventListener('click', function() { if (!scrapedData) return; chrome.runtime.sendMessage({action:'downloadCSV',data:scrapedData,csvType:'links'}); showToast('Links CSV started'); });
btnCSVEmails.addEventListener('click', function() { if (!scrapedData) return; chrome.runtime.sendMessage({action:'downloadCSV',data:scrapedData,csvType:'emails'}); showToast('Emails CSV started'); });
btnCSVPhones.addEventListener('click', function() { if (!scrapedData) return; chrome.runtime.sendMessage({action:'downloadCSV',data:scrapedData,csvType:'phones'}); showToast('Phones CSV started'); });

// Screenshot
btnScreenshot.addEventListener('click', function() {
  if (!scrapedData) return;
  chrome.runtime.sendMessage({action:'screenshot'}, function(r) {
    if (r&&r.error) { showError(r.error); } else { showToast('Screenshot saved'); }
  });
});

btnHistory.addEventListener('click', openHistory);
btnCloseHist.addEventListener('click', closeHistory);
btnClearHist.addEventListener('click', function() { chrome.runtime.sendMessage({action:'clearHistory'}, function() { loadHistory(); showToast('History cleared'); }); });
historyOverlay.addEventListener('click', function(e) { if (e.target === historyOverlay) closeHistory(); });
