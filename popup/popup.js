'use strict';

// ── DOM References ──
var btnScrape = document.getElementById('btnScrape');
var btnJSON = document.getElementById('btnJSON');
var btnZIP = document.getElementById('btnZIP');
var btnCopy = document.getElementById('btnCopy');
var btnCSVImages = document.getElementById('btnCSVImages');
var btnCSVLinks = document.getElementById('btnCSVLinks');
var btnCSVEmails = document.getElementById('btnCSVEmails');
var btnMarkdown = document.getElementById('btnMarkdown');
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
var techSection = document.getElementById('techSection');
var techChips = document.getElementById('techChips');
var mediaSection = document.getElementById('mediaSection');
var mediaList = document.getElementById('mediaList');
var mediaCount = document.getElementById('mediaCount');
var fontsSection = document.getElementById('fontsSection');
var fontChips = document.getElementById('fontChips');
var colorsSection = document.getElementById('colorsSection');
var colorSwatches = document.getElementById('colorSwatches');
var tablesSection = document.getElementById('tablesSection');
var tablesList = document.getElementById('tablesList');
var tablesCount = document.getElementById('tablesCount');
var historyOverlay = document.getElementById('historyOverlay');
var historyList = document.getElementById('historyList');
var historyEmpty = document.getElementById('historyEmpty');
var toast = document.getElementById('toast');
var toastText = document.getElementById('toastText');
var btnTheme = document.getElementById('btnTheme');
var themeIcon = document.getElementById('themeIcon');
var searchBar = document.getElementById('searchBar');
var searchInput = document.getElementById('searchInput');
var searchCount = document.getElementById('searchCount');
var perfSection = document.getElementById('perfSection');
var perfGrid = document.getElementById('perfGrid');
var structuredSection = document.getElementById('structuredSection');
var structuredList = document.getElementById('structuredList');
var structuredCount = document.getElementById('structuredCount');

var scrapedData = null;

var allSections = function() {
  return [statsPanel,pageTitle,imagePreview,metaPreview,contactsSection,socialSection,
    headingsSection,techSection,mediaSection,fontsSection,colorsSection,tablesSection,
    perfSection,structuredSection,searchBar];
};

// ── Helpers ──
function setStatus(s, t) { statusChip.className = 'status-chip ' + s; statusText.textContent = t; }
function showError(m) { errorText.textContent = m; errorMessage.classList.remove('hidden'); }
function hideError() { errorMessage.classList.add('hidden'); }
function fmt(n) { return n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : String(n); }
function esc(s) { return (s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

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
  [btnJSON, btnZIP, btnCopy, btnCSVImages, btnCSVLinks, btnScreenshot, btnMarkdown].forEach(function(b) { b.disabled = !on; });
  btnCSVEmails.disabled = !(on && scrapedData && scrapedData.emails && scrapedData.emails.length > 0);
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
  (emails || []).slice(0, 6).forEach(function(e) {
    var chip = document.createElement('div'); chip.className = 'contact-chip email';
    chip.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>';
    var span = document.createElement('span'); span.textContent = e; chip.appendChild(span);
    chip.title = 'Click to copy: ' + e;
    chip.addEventListener('click', function() { navigator.clipboard.writeText(e); showToast('Copied: ' + e); });
    contactsGrid.appendChild(chip);
  });
  (phones || []).slice(0, 6).forEach(function(p) {
    var chip = document.createElement('div'); chip.className = 'contact-chip phone';
    chip.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>';
    var span = document.createElement('span'); span.textContent = p; chip.appendChild(span);
    chip.title = 'Click to copy: ' + p;
    chip.addEventListener('click', function() { navigator.clipboard.writeText(p); showToast('Copied: ' + p); });
    contactsGrid.appendChild(chip);
  });
  contactsSection.classList.remove('hidden');
}

// ── Social Links ──
var socialIcons = { twitter:'\ud835\udd4f', facebook:'f', instagram:'\ud83d\udcf7', youtube:'\u25b6', linkedin:'in', github:'\u2328', tiktok:'\u266a', pinterest:'\ud83d\udccc', reddit:'r', discord:'\ud83d\udcac' };
function showSocial(social) {
  socialChips.innerHTML = '';
  if (!social || Object.keys(social).length === 0) { socialSection.classList.add('hidden'); return; }
  Object.keys(social).forEach(function(platform) {
    var chip = document.createElement('div'); chip.className = 'social-chip';
    var icon = document.createElement('span'); icon.className = 'social-icon'; icon.textContent = socialIcons[platform] || '\ud83d\udd17';
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
  headings.slice(0, 15).forEach(function(h) {
    var row = document.createElement('div'); row.className = 'heading-row level-' + h.level;
    var badge = document.createElement('span'); badge.className = 'heading-badge'; badge.textContent = 'H' + h.level;
    var text = document.createElement('span'); text.className = 'heading-text'; text.textContent = h.text;
    row.appendChild(badge); row.appendChild(text);
    headingsList.appendChild(row);
  });
  if (headings.length > 15) {
    var more = document.createElement('div'); more.className = 'heading-row more';
    more.textContent = '+' + (headings.length - 15) + ' more';
    headingsList.appendChild(more);
  }
  headingsSection.classList.remove('hidden');
}

// ── Technologies ──
function showTech(techs) {
  techChips.innerHTML = '';
  if (!techs || techs.length === 0) { techSection.classList.add('hidden'); return; }
  techs.forEach(function(t) {
    var chip = document.createElement('span'); chip.className = 'tech-chip';
    chip.textContent = t;
    techChips.appendChild(chip);
  });
  techSection.classList.remove('hidden');
}

// ── Media (Videos/Audio) ──
function showMedia(videos, audios) {
  mediaList.innerHTML = '';
  var vids = videos || [], auds = audios || [];
  var total = vids.length + auds.length;
  if (total === 0) { mediaSection.classList.add('hidden'); return; }
  mediaCount.textContent = total + ' found';
  vids.slice(0, 6).forEach(function(url) {
    var row = document.createElement('div'); row.className = 'media-row';
    row.innerHTML = '<span class="media-type-badge video">\u25b6 VID</span>';
    var link = document.createElement('span'); link.className = 'media-url'; link.textContent = url; link.title = url;
    row.appendChild(link);
    row.addEventListener('click', function() { navigator.clipboard.writeText(url); showToast('Video URL copied'); });
    mediaList.appendChild(row);
  });
  auds.slice(0, 4).forEach(function(url) {
    var row = document.createElement('div'); row.className = 'media-row';
    row.innerHTML = '<span class="media-type-badge audio">\u266a AUD</span>';
    var link = document.createElement('span'); link.className = 'media-url'; link.textContent = url; link.title = url;
    row.appendChild(link);
    row.addEventListener('click', function() { navigator.clipboard.writeText(url); showToast('Audio URL copied'); });
    mediaList.appendChild(row);
  });
  mediaSection.classList.remove('hidden');
}

// ── Fonts ──
function showFonts(fonts) {
  fontChips.innerHTML = '';
  if (!fonts || fonts.length === 0) { fontsSection.classList.add('hidden'); return; }
  fonts.slice(0, 12).forEach(function(f) {
    var chip = document.createElement('span'); chip.className = 'font-chip';
    chip.textContent = f;
    chip.style.fontFamily = '"' + f + '", sans-serif';
    chip.title = f;
    chip.addEventListener('click', function() { navigator.clipboard.writeText(f); showToast('Copied: ' + f); });
    fontChips.appendChild(chip);
  });
  fontsSection.classList.remove('hidden');
}

// ── Color Palette ──
function showColors(colors) {
  colorSwatches.innerHTML = '';
  if (!colors || colors.length === 0) { colorsSection.classList.add('hidden'); return; }
  colors.slice(0, 18).forEach(function(c) {
    var swatch = document.createElement('div'); swatch.className = 'color-swatch';
    swatch.style.background = c;
    swatch.title = c;
    swatch.addEventListener('click', function() { navigator.clipboard.writeText(c); showToast('Copied: ' + c); });
    colorSwatches.appendChild(swatch);
  });
  colorsSection.classList.remove('hidden');
}

// ── Tables ──
function showTables(tables) {
  tablesList.innerHTML = '';
  if (!tables || tables.length === 0) { tablesSection.classList.add('hidden'); return; }
  tablesCount.textContent = tables.length + ' found';
  tables.slice(0, 5).forEach(function(tbl, idx) {
    var card = document.createElement('div'); card.className = 'table-card';
    var header = document.createElement('div'); header.className = 'table-card-header';
    header.textContent = 'Table ' + (idx + 1) + ' \u2014 ' + tbl.rowCount + ' rows' + (tbl.headers.length > 0 ? ', ' + tbl.headers.length + ' cols' : '');
    card.appendChild(header);
    if (tbl.headers.length > 0) {
      var headerRow = document.createElement('div'); headerRow.className = 'table-card-cols';
      headerRow.textContent = tbl.headers.join(' \u00b7 ');
      card.appendChild(headerRow);
    }
    // Show first 2 rows preview
    tbl.rows.slice(0, 2).forEach(function(row) {
      var rowDiv = document.createElement('div'); rowDiv.className = 'table-card-row';
      rowDiv.textContent = row.join(' | ');
      card.appendChild(rowDiv);
    });
    if (tbl.rows.length > 2) {
      var more = document.createElement('div'); more.className = 'table-card-more';
      more.textContent = '+' + (tbl.rows.length - 2) + ' more rows';
      card.appendChild(more);
    }
    tablesList.appendChild(card);
  });
  tablesSection.classList.remove('hidden');
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
    item.innerHTML = '<div class="history-item-title">' + esc(e.title||'Untitled') + '</div><div class="history-item-url">' + esc(e.url) + '</div><div class="history-item-stats">' + e.images + ' imgs \u00b7 ' + e.links + ' links \u00b7 ' + fmt(e.textLength) + ' chars</div><div class="history-item-time">' + fmtTime(e.scrapedAt) + '</div>';
    historyList.appendChild(item);
  });
}
function fmtTime(iso) {
  var d = new Date(iso), diff = Date.now() - d.getTime(), m = Math.floor(diff/6e4), h = Math.floor(diff/36e5), dy = Math.floor(diff/864e5);
  if (m < 1) return 'Just now'; if (m < 60) return m+'m ago'; if (h < 24) return h+'h ago'; if (dy < 7) return dy+'d ago'; return d.toLocaleDateString();
}

// ── Markdown Generator ──
function generateMarkdown(d) {
  var md = '# ' + (d.title || 'Untitled Page') + '\n\n';
  md += '**URL:** ' + d.url + '  \n';
  md += '**Scraped:** ' + d.scrapedAt + '  \n';
  md += '**Words:** ' + fmt(d.wordCount || 0) + ' | **Reading Time:** ~' + (d.readingTimeMin || 1) + ' min\n\n';
  md += '---\n\n';
  if (d.technologies && d.technologies.length > 0) {
    md += '## Technologies\n\n' + d.technologies.map(function(t) { return '`' + t + '`'; }).join(' ') + '\n\n';
  }
  if (d.meta) {
    md += '## Meta Tags\n\n';
    if (d.meta.description) md += '- **Description:** ' + d.meta.description + '\n';
    if (d.meta.keywords) md += '- **Keywords:** ' + d.meta.keywords + '\n';
    if (d.meta.author) md += '- **Author:** ' + d.meta.author + '\n';
    md += '\n';
  }
  if (d.headings && d.headings.length > 0) {
    md += '## Headings Structure\n\n';
    d.headings.forEach(function(h) { md += '  '.repeat(h.level - 1) + '- **H' + h.level + ':** ' + h.text + '\n'; });
    md += '\n';
  }
  if (d.images && d.images.length > 0) {
    md += '## Images (' + d.images.length + ')\n\n';
    d.images.slice(0, 20).forEach(function(u, i) { md += (i + 1) + '. ' + u + '\n'; });
    if (d.images.length > 20) md += '\n*...and ' + (d.images.length - 20) + ' more*\n';
    md += '\n';
  }
  if (d.links && d.links.length > 0) {
    md += '## Links (' + d.links.length + ')\n\n';
    d.links.slice(0, 20).forEach(function(u, i) { md += (i + 1) + '. ' + u + '\n'; });
    if (d.links.length > 20) md += '\n*...and ' + (d.links.length - 20) + ' more*\n';
    md += '\n';
  }
  if (d.emails && d.emails.length > 0) {
    md += '## Emails\n\n';
    d.emails.forEach(function(e) { md += '- ' + e + '\n'; });
    md += '\n';
  }
  if (d.fonts && d.fonts.length > 0) {
    md += '## Fonts\n\n' + d.fonts.map(function(f) { return '`' + f + '`'; }).join(' ') + '\n\n';
  }
  if (d.text) {
    md += '## Content\n\n' + d.text.substring(0, 5000) + '\n';
  }
  return md;
}

// ── Performance Stats ──
function showPerf(perf) {
  perfGrid.innerHTML = '';
  if (!perf) { perfSection.classList.add('hidden'); return; }
  var items = [
    {v:fmt(perf.domElements||0),l:'DOM Nodes'},
    {v:perf.scripts||0,l:'Scripts'},
    {v:perf.stylesheets||0,l:'Styles'},
    {v:(perf.htmlSizeKB||0)+'K',l:'HTML Size'},
    {v:perf.cookies||0,l:'Cookies'},
    {v:perf.forms||0,l:'Forms'}
  ];
  items.forEach(function(it) {
    var pill = document.createElement('div'); pill.className = 'perf-pill';
    var v = document.createElement('span'); v.className = 'perf-val'; v.textContent = it.v;
    var l = document.createElement('span'); l.className = 'perf-label'; l.textContent = it.l;
    pill.appendChild(v); pill.appendChild(l); perfGrid.appendChild(pill);
  });
  perfSection.classList.remove('hidden');
}

// ── Structured Data (JSON-LD) ──
function showStructuredData(data) {
  structuredList.innerHTML = '';
  if (!data || data.length === 0) { structuredSection.classList.add('hidden'); return; }
  structuredCount.textContent = data.length + ' found';
  data.slice(0, 5).forEach(function(item) {
    var card = document.createElement('div'); card.className = 'structured-card';
    var typeDiv = document.createElement('div'); typeDiv.className = 'structured-card-type';
    var badge = document.createElement('span'); badge.className = 'structured-type-badge';
    badge.textContent = item['@type'] || 'JSON-LD';
    typeDiv.appendChild(badge);
    if (item.name) { var n = document.createElement('span'); n.textContent = item.name; typeDiv.appendChild(n); }
    card.appendChild(typeDiv);
    var body = document.createElement('div'); body.className = 'structured-card-body';
    body.textContent = JSON.stringify(item, null, 1).substring(0, 200);
    card.appendChild(body);
    card.addEventListener('click', function() { navigator.clipboard.writeText(JSON.stringify(item,null,2)); showToast('JSON-LD copied'); });
    structuredList.appendChild(card);
  });
  structuredSection.classList.remove('hidden');
}

// ── Search / Filter ──
function handleSearch() {
  var q = searchInput.value.trim().toLowerCase();
  if (!q || !scrapedData) { searchCount.textContent = ''; document.querySelectorAll('.search-hidden').forEach(function(el) { el.classList.remove('search-hidden'); }); return; }
  var total = 0;
  // Filter contact chips, heading rows, media rows, tech chips, font chips, meta tags, table cards, structured cards
  var selectors = '.contact-chip, .heading-row:not(.more), .media-row, .tech-chip, .font-chip, .meta-tag, .table-card, .structured-card, .social-chip';
  document.querySelectorAll(selectors).forEach(function(el) {
    var text = (el.textContent || '').toLowerCase();
    if (text.indexOf(q) >= 0) { el.classList.remove('search-hidden'); total++; }
    else { el.classList.add('search-hidden'); }
  });
  searchCount.textContent = total + ' matches';
}

// ── Theme Toggle ──
function loadTheme() {
  chrome.storage.local.get({theme:'dark'}, function(r) {
    if (r.theme === 'light') { document.body.classList.add('light'); updateThemeIcon(true); }
  });
}
function toggleTheme() {
  var isLight = document.body.classList.toggle('light');
  chrome.storage.local.set({theme: isLight ? 'light' : 'dark'});
  updateThemeIcon(isLight);
}
function updateThemeIcon(isLight) {
  themeIcon.innerHTML = isLight
    ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
    : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
}
loadTheme();

// ── EVENTS ──

btnScrape.addEventListener('click', async function() {
  hideError(); setStatus('scraping','Scraping\u2026'); setScraping(true); toggleDownloads(false);
  allSections().forEach(function(el) { el.classList.add('hidden'); });
  searchInput.value = '';
  try {
    var tabs = await chrome.tabs.query({active:true,currentWindow:true}); var tab = tabs[0];
    if (!tab||!tab.id) throw new Error('No active tab found.');
    if (tab.url&&(tab.url.startsWith('chrome://')||tab.url.startsWith('chrome-extension://')||tab.url.startsWith('about:'))) throw new Error('Cannot scrape internal pages.');
    var r = await chrome.runtime.sendMessage({action:'scrape',tabId:tab.id});
    if (r&&r.error) throw new Error(r.error);
    if (!r||!r.data) throw new Error('No data returned.');
    scrapedData = r.data;
    setStatus('done','Scrape complete');
    showStats(scrapedData);
    showImagePreview(scrapedData.images);
    showMetaPreview(scrapedData.meta);
    showContacts(scrapedData.emails, scrapedData.phones);
    showSocial(scrapedData.socialLinks);
    showHeadings(scrapedData.headings);
    showTech(scrapedData.technologies);
    showMedia(scrapedData.videos, scrapedData.audios);
    showFonts(scrapedData.fonts);
    showColors(scrapedData.colors);
    showTables(scrapedData.tables);
    showPerf(scrapedData.performance);
    showStructuredData(scrapedData.structuredData);
    searchBar.classList.remove('hidden');
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
btnMarkdown.addEventListener('click', function() { if (!scrapedData) return; chrome.runtime.sendMessage({action:'downloadMarkdown',data:scrapedData}); showToast('Markdown download started'); });
btnScreenshot.addEventListener('click', function() { if (!scrapedData) return; chrome.runtime.sendMessage({action:'screenshot'}, function(r) { if (r&&r.error) { showError(r.error); } else { showToast('Screenshot saved'); } }); });
btnTheme.addEventListener('click', toggleTheme);
searchInput.addEventListener('input', handleSearch);

// ── Keyboard Shortcuts ──
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'Enter') { e.preventDefault(); btnScrape.click(); }
    else if (e.key === 'j') { e.preventDefault(); btnJSON.click(); }
    else if (e.key === 'k') { e.preventDefault(); btnCopy.click(); }
    else if (e.key === 'f') { e.preventDefault(); searchInput.focus(); }
  }
});

btnHistory.addEventListener('click', openHistory);
btnCloseHist.addEventListener('click', closeHistory);
btnClearHist.addEventListener('click', function() { chrome.runtime.sendMessage({action:'clearHistory'}, function() { loadHistory(); showToast('History cleared'); }); });
historyOverlay.addEventListener('click', function(e) { if (e.target === historyOverlay) closeHistory(); });
