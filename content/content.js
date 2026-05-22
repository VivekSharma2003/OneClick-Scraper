/**
 * OneClick Scraper — Content Script
 * Injected programmatically into the active tab to extract page data.
 */
'use strict';

(function () {
  var MAX_TEXT_LENGTH = 500000;

  function toAbsoluteURL(url) {
    if (!url || typeof url !== 'string') return null;
    url = url.trim();
    if (!url || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:')) return null;
    try { return new URL(url, document.baseURI).href; } catch (e) { return null; }
  }

  function extractImages() {
    var urls = new Set();
    document.querySelectorAll('img').forEach(function (img) {
      ['src', 'data-src', 'data-lazy-src'].forEach(function (attr) {
        var abs = toAbsoluteURL(img.getAttribute(attr));
        if (abs) urls.add(abs);
      });
      var srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
      if (srcset) {
        srcset.split(',').forEach(function (entry) {
          var abs = toAbsoluteURL(entry.trim().split(/\s+/)[0]);
          if (abs) urls.add(abs);
        });
      }
    });
    document.querySelectorAll('picture source').forEach(function (source) {
      var srcset = source.getAttribute('srcset');
      if (srcset) srcset.split(',').forEach(function (entry) {
        var abs = toAbsoluteURL(entry.trim().split(/\s+/)[0]);
        if (abs) urls.add(abs);
      });
    });
    document.querySelectorAll('[style*="background"]').forEach(function (el) {
      var match = (el.getAttribute('style') || '').match(/url\(["']?([^"')]+)["']?\)/);
      if (match && match[1]) { var abs = toAbsoluteURL(match[1]); if (abs) urls.add(abs); }
    });
    return Array.from(urls);
  }

  function extractLinks() {
    var urls = new Set();
    document.querySelectorAll('a[href]').forEach(function (a) {
      var abs = toAbsoluteURL(a.getAttribute('href'));
      if (abs) urls.add(abs);
    });
    return Array.from(urls);
  }

  function extractText() {
    var containers = document.querySelectorAll('article, main, [role="main"]');
    var root;
    if (containers.length > 0) {
      var maxLen = 0;
      containers.forEach(function (c) {
        var len = (c.textContent || '').length;
        if (len > maxLen) { maxLen = len; root = c; }
      });
    }
    if (!root) root = document.body;
    var clone = root.cloneNode(true);
    ['script','style','noscript','svg','nav','footer','header','aside','iframe','form','button','input','select','textarea'].forEach(function (tag) {
      clone.querySelectorAll(tag).forEach(function (el) { el.remove(); });
    });
    var text = (clone.textContent || '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
    if (text.length > MAX_TEXT_LENGTH) {
      text = text.substring(0, MAX_TEXT_LENGTH) + '\n\n[Truncated]';
    }
    return text;
  }

  function extractMeta() {
    var meta = {};
    var descEl = document.querySelector('meta[name="description"]');
    if (descEl) meta.description = descEl.getAttribute('content') || '';
    var keywordsEl = document.querySelector('meta[name="keywords"]');
    if (keywordsEl) meta.keywords = keywordsEl.getAttribute('content') || '';
    var authorEl = document.querySelector('meta[name="author"]');
    if (authorEl) meta.author = authorEl.getAttribute('content') || '';

    var ogTags = {};
    document.querySelectorAll('meta[property^="og:"]').forEach(function (el) {
      ogTags[el.getAttribute('property').replace('og:', '')] = el.getAttribute('content') || '';
    });
    if (Object.keys(ogTags).length > 0) meta.og = ogTags;

    var twitterTags = {};
    document.querySelectorAll('meta[name^="twitter:"]').forEach(function (el) {
      twitterTags[el.getAttribute('name').replace('twitter:', '')] = el.getAttribute('content') || '';
    });
    if (Object.keys(twitterTags).length > 0) meta.twitter = twitterTags;

    var favicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
    if (favicon) { var href = toAbsoluteURL(favicon.getAttribute('href')); if (href) meta.favicon = href; }
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) meta.canonical = canonical.getAttribute('href') || '';
    var lang = document.documentElement.getAttribute('lang');
    if (lang) meta.language = lang;
    return meta;
  }

  /** Extract emails found on page */
  function extractEmails() {
    var bodyText = document.body.innerText || '';
    // Also check mailto: links
    var emails = new Set();
    document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
      var email = a.getAttribute('href').replace('mailto:', '').split('?')[0].trim();
      if (email) emails.add(email.toLowerCase());
    });
    // Regex scan body text
    var emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    var matches = bodyText.match(emailRegex);
    if (matches) matches.forEach(function (e) { emails.add(e.toLowerCase()); });
    return Array.from(emails);
  }

  /** Extract phone numbers found on page */
  function extractPhones() {
    var phones = new Set();
    document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
      var phone = a.getAttribute('href').replace('tel:', '').trim();
      if (phone) phones.add(phone);
    });
    // Regex scan for common phone patterns
    var bodyText = document.body.innerText || '';
    var phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
    var matches = bodyText.match(phoneRegex);
    if (matches) {
      matches.forEach(function (p) {
        var cleaned = p.replace(/\s+/g, ' ').trim();
        // Only add if it looks like a real phone (7+ digits)
        if (cleaned.replace(/\D/g, '').length >= 7) phones.add(cleaned);
      });
    }
    return Array.from(phones).slice(0, 50); // Cap at 50
  }

  /** Extract heading hierarchy for SEO */
  function extractHeadings() {
    var headings = [];
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(function (h) {
      var text = (h.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) {
        headings.push({
          level: parseInt(h.tagName.charAt(1)),
          text: text.substring(0, 200)
        });
      }
    });
    return headings.slice(0, 100); // Cap at 100
  }

  /** Categorize social media links */
  function extractSocialLinks(links) {
    var platforms = {
      twitter: /twitter\.com|x\.com/i,
      facebook: /facebook\.com|fb\.com/i,
      instagram: /instagram\.com/i,
      youtube: /youtube\.com|youtu\.be/i,
      linkedin: /linkedin\.com/i,
      github: /github\.com/i,
      tiktok: /tiktok\.com/i,
      pinterest: /pinterest\.com/i,
      reddit: /reddit\.com/i,
      discord: /discord\.gg|discord\.com/i
    };

    var social = {};
    links.forEach(function (url) {
      Object.keys(platforms).forEach(function (name) {
        if (platforms[name].test(url)) {
          if (!social[name]) social[name] = [];
          if (social[name].length < 5) social[name].push(url); // Max 5 per platform
        }
      });
    });
    return social;
  }

  /** Word count and reading time */
  function computeReadingStats(text) {
    var words = text.split(/\s+/).filter(function (w) { return w.length > 0; });
    var wordCount = words.length;
    var readingTimeMin = Math.max(1, Math.ceil(wordCount / 230));
    return { wordCount: wordCount, readingTimeMin: readingTimeMin };
  }

  /** Detect technologies/frameworks used on the page */
  function detectTechnologies() {
    var techs = [];
    // React
    if (document.querySelector('[data-reactroot], [data-reactid]') || window.__REACT_DEVTOOLS_GLOBAL_HOOK__ || document.querySelector('#__next')) techs.push('React');
    // Next.js
    if (document.querySelector('#__next') || document.querySelector('script[src*="_next"]')) techs.push('Next.js');
    // Vue
    if (document.querySelector('[data-v-]') || window.__VUE__ || document.querySelector('[id="app"].__vue__')) techs.push('Vue.js');
    // Nuxt
    if (document.querySelector('#__nuxt') || window.__NUXT__) techs.push('Nuxt');
    // Angular
    if (document.querySelector('[ng-version], [_nghost], [_ngcontent]') || window.ng) techs.push('Angular');
    // jQuery
    if (window.jQuery || window.$) techs.push('jQuery');
    // WordPress
    if (document.querySelector('meta[name="generator"][content*="WordPress"], link[href*="wp-content"], link[href*="wp-includes"]')) techs.push('WordPress');
    // Shopify
    if (window.Shopify || document.querySelector('meta[name="shopify-checkout-api-token"], link[href*="cdn.shopify"]')) techs.push('Shopify');
    // Bootstrap
    if (document.querySelector('link[href*="bootstrap"], .container-fluid, .navbar-toggler')) techs.push('Bootstrap');
    // Tailwind
    if (document.querySelector('[class*="flex"][class*="items-"], [class*="bg-"][class*="text-"]')) techs.push('Tailwind CSS');
    // Google Analytics
    if (window.ga || window.gtag || document.querySelector('script[src*="google-analytics"], script[src*="googletagmanager"]')) techs.push('Google Analytics');
    // Google Tag Manager
    if (window.google_tag_manager || document.querySelector('script[src*="gtm.js"]')) techs.push('GTM');
    // TypeScript (compiled indicators)
    if (document.querySelector('script[src*=".ts"], script[src*="tslib"]')) techs.push('TypeScript');
    // Webpack
    if (window.webpackJsonp || window.webpackChunk || document.querySelector('script[src*="webpack"]')) techs.push('Webpack');
    // Vite
    if (document.querySelector('script[type="module"][src*="/@vite"], script[src*="vite"]')) techs.push('Vite');
    // Gatsby
    if (document.querySelector('#___gatsby')) techs.push('Gatsby');
    // Svelte
    if (document.querySelector('[class*="svelte-"]')) techs.push('Svelte');
    // Font Awesome
    if (document.querySelector('link[href*="font-awesome"], link[href*="fontawesome"], .fa, .fas, .fab')) techs.push('Font Awesome');
    // Cloudflare
    if (document.querySelector('script[src*="cloudflare"], link[href*="cdnjs.cloudflare"]')) techs.push('Cloudflare');
    return techs;
  }

  /** Extract video and audio sources */
  function extractMedia() {
    var videos = new Set();
    var audios = new Set();
    // <video> tags
    document.querySelectorAll('video').forEach(function(v) {
      var src = v.getAttribute('src');
      if (src) { var abs = toAbsoluteURL(src); if (abs) videos.add(abs); }
      v.querySelectorAll('source').forEach(function(s) {
        var ss = s.getAttribute('src');
        if (ss) { var abs = toAbsoluteURL(ss); if (abs) videos.add(abs); }
      });
    });
    // <audio> tags
    document.querySelectorAll('audio').forEach(function(a) {
      var src = a.getAttribute('src');
      if (src) { var abs = toAbsoluteURL(src); if (abs) audios.add(abs); }
      a.querySelectorAll('source').forEach(function(s) {
        var ss = s.getAttribute('src');
        if (ss) { var abs = toAbsoluteURL(ss); if (abs) audios.add(abs); }
      });
    });
    // <iframe> embeds (YouTube, Vimeo)
    document.querySelectorAll('iframe[src]').forEach(function(f) {
      var src = f.getAttribute('src') || '';
      if (/youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com/.test(src)) {
        var abs = toAbsoluteURL(src);
        if (abs) videos.add(abs);
      }
    });
    return { videos: Array.from(videos).slice(0, 30), audios: Array.from(audios).slice(0, 20) };
  }

  /** Detect font families used on the page */
  function extractFonts() {
    var fonts = new Set();
    // Check stylesheets for @font-face
    try {
      for (var i = 0; i < document.styleSheets.length; i++) {
        try {
          var rules = document.styleSheets[i].cssRules || [];
          for (var j = 0; j < rules.length; j++) {
            if (rules[j].type === CSSRule.FONT_FACE_RULE) {
              var family = rules[j].style.getPropertyValue('font-family').replace(/['"]/g, '').trim();
              if (family) fonts.add(family);
            }
          }
        } catch(e) { /* cross-origin stylesheets */ }
      }
    } catch(e) {}
    // Sample computed fonts from visible elements
    var sampleEls = document.querySelectorAll('body, h1, h2, h3, p, a, span, div, li, td, th, button, input');
    var checked = 0;
    sampleEls.forEach(function(el) {
      if (checked > 50) return;
      checked++;
      var cs = window.getComputedStyle(el);
      var ff = cs.fontFamily;
      if (ff) {
        ff.split(',').forEach(function(f) {
          var clean = f.replace(/['"]/g, '').trim();
          if (clean && !/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|inherit|initial|unset|-apple-system|BlinkMacSystemFont)$/i.test(clean)) {
            fonts.add(clean);
          }
        });
      }
    });
    return Array.from(fonts).slice(0, 20);
  }

  /** Extract HTML tables as structured data */
  function extractTables() {
    var tables = [];
    document.querySelectorAll('table').forEach(function(table, idx) {
      if (idx >= 10) return; // Max 10 tables
      var headers = [];
      var rows = [];
      // Extract headers
      table.querySelectorAll('thead th, thead td, tr:first-child th').forEach(function(th) {
        headers.push((th.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 100));
      });
      // Extract rows
      var trs = table.querySelectorAll('tbody tr, tr');
      var startIdx = headers.length > 0 ? 0 : 0;
      trs.forEach(function(tr, ri) {
        if (ri >= 50) return; // Max 50 rows per table
        // Skip header row if it was already captured
        if (ri === 0 && tr.querySelectorAll('th').length > 0 && headers.length > 0) return;
        var cells = [];
        tr.querySelectorAll('td, th').forEach(function(td) {
          cells.push((td.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 200));
        });
        if (cells.length > 0) rows.push(cells);
      });
      if (rows.length > 0 || headers.length > 0) {
        tables.push({ headers: headers, rows: rows, rowCount: rows.length });
      }
    });
    return tables;
  }

  /** Extract CSS color palette from custom properties */
  function extractColors() {
    var colors = new Set();
    var colorRegex = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)/g;
    try {
      var rootStyles = window.getComputedStyle(document.documentElement);
      var allProps = [];
      for (var i = 0; i < document.styleSheets.length; i++) {
        try {
          var rules = document.styleSheets[i].cssRules || [];
          for (var j = 0; j < rules.length; j++) {
            if (rules[j].selectorText === ':root' || rules[j].selectorText === 'html') {
              var text = rules[j].cssText;
              var matches = text.match(colorRegex);
              if (matches) matches.forEach(function(c) { colors.add(c); });
            }
          }
        } catch(e) {}
      }
    } catch(e) {}
    var sampleEls = document.querySelectorAll('body, header, footer, nav, main, .hero, .banner, button, a');
    var checked = 0;
    sampleEls.forEach(function(el) {
      if (checked > 30) return;
      checked++;
      var cs = window.getComputedStyle(el);
      ['color', 'backgroundColor', 'borderColor'].forEach(function(prop) {
        var val = cs[prop];
        if (val && val !== 'rgba(0, 0, 0, 0)' && val !== 'transparent') {
          colors.add(val);
        }
      });
    });
    return Array.from(colors).slice(0, 24);
  }

  /** Page performance / DOM statistics */
  function extractPagePerformance() {
    var perf = {};
    perf.domElements = document.querySelectorAll('*').length;
    perf.scripts = document.querySelectorAll('script').length;
    perf.stylesheets = document.querySelectorAll('link[rel="stylesheet"], style').length;
    perf.iframes = document.querySelectorAll('iframe').length;
    perf.forms = document.querySelectorAll('form').length;
    perf.inputs = document.querySelectorAll('input, textarea, select').length;
    perf.buttons = document.querySelectorAll('button, [role="button"], input[type="submit"]').length;
    // Estimate HTML size
    try { perf.htmlSizeKB = Math.round(document.documentElement.outerHTML.length / 1024); } catch(e) { perf.htmlSizeKB = 0; }
    // Cookie count
    try { perf.cookies = document.cookie ? document.cookie.split(';').filter(function(c) { return c.trim().length > 0; }).length : 0; } catch(e) { perf.cookies = 0; }
    // Navigation timing
    try {
      if (window.performance && window.performance.timing) {
        var t = window.performance.timing;
        perf.loadTimeMs = t.loadEventEnd - t.navigationStart;
        perf.domReadyMs = t.domContentLoadedEventEnd - t.navigationStart;
      }
    } catch(e) {}
    return perf;
  }

  /** Extract JSON-LD structured data (Schema.org) */
  function extractStructuredData() {
    var results = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach(function(script) {
      try {
        var data = JSON.parse(script.textContent);
        if (Array.isArray(data)) {
          data.forEach(function(item) { results.push(item); });
        } else {
          results.push(data);
        }
      } catch(e) { /* invalid JSON-LD */ }
    });
    return results.slice(0, 10); // Cap at 10
  }

  /** SEO Score — quick automated audit */
  function computeSeoScore(title, meta, headings, images) {
    var checks = [];
    // Title
    var tLen = (title || '').length;
    checks.push({name:'Title exists', pass: tLen > 0, tip: tLen > 0 ? tLen + ' chars' : 'Missing'});
    checks.push({name:'Title length', pass: tLen >= 30 && tLen <= 65, tip: tLen + '/65 chars'});
    // Meta description
    var desc = meta && meta.description ? meta.description : '';
    checks.push({name:'Meta description', pass: desc.length > 0, tip: desc.length > 0 ? desc.length + ' chars' : 'Missing'});
    checks.push({name:'Desc length', pass: desc.length >= 70 && desc.length <= 160, tip: desc.length + '/160 chars'});
    // H1
    var h1s = headings.filter(function(h) { return h.level === 1; });
    checks.push({name:'H1 tag', pass: h1s.length === 1, tip: h1s.length + ' found'});
    // Image alt tags
    var allImgs = document.querySelectorAll('img');
    var missingAlt = 0;
    allImgs.forEach(function(img) { if (!img.getAttribute('alt')) missingAlt++; });
    checks.push({name:'Image alt tags', pass: missingAlt === 0, tip: missingAlt > 0 ? missingAlt + ' missing' : 'All set'});
    // Canonical
    checks.push({name:'Canonical URL', pass: !!(meta && meta.canonical), tip: meta && meta.canonical ? 'Set' : 'Missing'});
    // HTTPS
    checks.push({name:'HTTPS', pass: window.location.protocol === 'https:', tip: window.location.protocol});
    // Language
    checks.push({name:'Lang attribute', pass: !!document.documentElement.getAttribute('lang'), tip: document.documentElement.getAttribute('lang') || 'Missing'});
    // Viewport
    var viewport = document.querySelector('meta[name="viewport"]');
    checks.push({name:'Viewport meta', pass: !!viewport, tip: viewport ? 'Set' : 'Missing'});
    var passed = checks.filter(function(c) { return c.pass; }).length;
    var score = Math.round((passed / checks.length) * 100);
    return {score: score, total: checks.length, passed: passed, checks: checks};
  }

  /** Link analysis — internal vs external, nofollow */
  function analyzeLinkTypes(links) {
    var host = window.location.hostname;
    var internal = 0, external = 0, nofollow = 0;
    var externalDomains = {};
    document.querySelectorAll('a[href]').forEach(function(a) {
      try {
        var href = a.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
        var url = new URL(href, document.baseURI);
        if (url.hostname === host) { internal++; }
        else { external++; var d = url.hostname; externalDomains[d] = (externalDomains[d]||0) + 1; }
        var rel = (a.getAttribute('rel') || '').toLowerCase();
        if (rel.indexOf('nofollow') >= 0) nofollow++;
      } catch(e) {}
    });
    // Top 5 external domains
    var topDomains = Object.keys(externalDomains).sort(function(a,b) { return externalDomains[b] - externalDomains[a]; }).slice(0,5).map(function(d) { return {domain:d, count:externalDomains[d]}; });
    return {internal: internal, external: external, nofollow: nofollow, topDomains: topDomains};
  }

  /** Accessibility quick audit */
  function runAccessibilityAudit() {
    var audit = {};
    var imgs = document.querySelectorAll('img');
    var missingAlt = 0; imgs.forEach(function(i) { if (!i.getAttribute('alt')) missingAlt++; });
    audit.totalImages = imgs.length;
    audit.missingAlt = missingAlt;
    audit.ariaLabels = document.querySelectorAll('[aria-label]').length;
    audit.ariaRoles = document.querySelectorAll('[role]').length;
    audit.hasLang = !!document.documentElement.getAttribute('lang');
    audit.hasSkipLink = !!document.querySelector('a[href="#main"], a[href="#content"], .skip-link, .skip-to-content');
    audit.tabIndex = document.querySelectorAll('[tabindex]').length;
    var score = 0, total = 5;
    if (audit.missingAlt === 0 && audit.totalImages > 0) score++;
    if (audit.hasLang) score++;
    if (audit.ariaRoles > 0) score++;
    if (audit.hasSkipLink) score++;
    if (audit.ariaLabels > 0) score++;
    audit.score = Math.round((score / total) * 100);
    return audit;
  }

  /** Detect page dates from meta tags */
  function extractPageDates() {
    var dates = {};
    var selectors = [
      {key:'published', sel:'meta[property="article:published_time"], meta[name="date"], meta[name="DC.date.issued"], meta[itemprop="datePublished"]'},
      {key:'modified', sel:'meta[property="article:modified_time"], meta[name="last-modified"], meta[http-equiv="last-modified"], meta[itemprop="dateModified"]'},
      {key:'created', sel:'meta[name="DC.date.created"]'}
    ];
    selectors.forEach(function(s) {
      var el = document.querySelector(s.sel);
      if (el) { var v = el.getAttribute('content') || el.getAttribute('datetime'); if (v) dates[s.key] = v; }
    });
    // Check <time> elements
    if (!dates.published) {
      var timeEl = document.querySelector('time[datetime]');
      if (timeEl) dates.published = timeEl.getAttribute('datetime');
    }
    return Object.keys(dates).length > 0 ? dates : null;
  }

  // ── Execute and return results ──
  var text = extractText();
  var links = extractLinks();
  var images = extractImages();
  var headings = extractHeadings();
  var readingStats = computeReadingStats(text);
  var media = extractMedia();
  var metaData = extractMeta();

  var result = {
    url: window.location.href,
    title: document.title || '',
    images: images,
    links: links,
    text: text,
    meta: metaData,
    emails: extractEmails(),
    phones: extractPhones(),
    headings: headings,
    socialLinks: extractSocialLinks(links),
    wordCount: readingStats.wordCount,
    readingTimeMin: readingStats.readingTimeMin,
    technologies: detectTechnologies(),
    videos: media.videos,
    audios: media.audios,
    fonts: extractFonts(),
    tables: extractTables(),
    colors: extractColors(),
    performance: extractPagePerformance(),
    structuredData: extractStructuredData(),
    seoScore: computeSeoScore(document.title, metaData, headings, images),
    linkAnalysis: analyzeLinkTypes(links),
    accessibility: runAccessibilityAudit(),
    pageDates: extractPageDates(),
    scrapedAt: new Date().toISOString()
  };

  return result;
})();
