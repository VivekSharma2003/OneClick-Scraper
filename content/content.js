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
    var readingTimeMin = Math.max(1, Math.ceil(wordCount / 230)); // ~230 WPM average
    return { wordCount: wordCount, readingTimeMin: readingTimeMin };
  }

  // ── Execute and return results ──
  var text = extractText();
  var links = extractLinks();
  var readingStats = computeReadingStats(text);

  var result = {
    url: window.location.href,
    title: document.title || '',
    images: extractImages(),
    links: links,
    text: text,
    meta: extractMeta(),
    emails: extractEmails(),
    phones: extractPhones(),
    headings: extractHeadings(),
    socialLinks: extractSocialLinks(links),
    wordCount: readingStats.wordCount,
    readingTimeMin: readingStats.readingTimeMin,
    scrapedAt: new Date().toISOString()
  };

  return result;
})();
