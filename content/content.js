/**
 * OneClick Scraper — Content Script
 * Injected programmatically into the active tab to extract page data.
 */
'use strict';

(function () {
  // Max text length to avoid performance issues on huge pages
  var MAX_TEXT_LENGTH = 500000;

  /**
   * Convert a potentially relative URL to absolute.
   */
  function toAbsoluteURL(url) {
    if (!url || typeof url !== 'string') return null;
    url = url.trim();
    if (!url || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:')) return null;
    try {
      return new URL(url, document.baseURI).href;
    } catch (e) {
      return null;
    }
  }

  /**
   * Extract all unique image URLs including lazy-loaded images.
   */
  function extractImages() {
    var urls = new Set();
    var imgs = document.querySelectorAll('img');

    imgs.forEach(function (img) {
      var src = img.getAttribute('src');
      var abs = toAbsoluteURL(src);
      if (abs) urls.add(abs);

      var dataSrc = img.getAttribute('data-src');
      abs = toAbsoluteURL(dataSrc);
      if (abs) urls.add(abs);

      var dataLazy = img.getAttribute('data-lazy-src');
      abs = toAbsoluteURL(dataLazy);
      if (abs) urls.add(abs);

      var srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
      if (srcset) {
        srcset.split(',').forEach(function (entry) {
          var parts = entry.trim().split(/\s+/);
          if (parts[0]) {
            abs = toAbsoluteURL(parts[0]);
            if (abs) urls.add(abs);
          }
        });
      }
    });

    document.querySelectorAll('picture source').forEach(function (source) {
      var srcset = source.getAttribute('srcset');
      if (srcset) {
        srcset.split(',').forEach(function (entry) {
          var parts = entry.trim().split(/\s+/);
          if (parts[0]) {
            var abs = toAbsoluteURL(parts[0]);
            if (abs) urls.add(abs);
          }
        });
      }
    });

    document.querySelectorAll('[style*="background"]').forEach(function (el) {
      var style = el.getAttribute('style') || '';
      var match = style.match(/url\(["']?([^"')]+)["']?\)/);
      if (match && match[1]) {
        var abs = toAbsoluteURL(match[1]);
        if (abs) urls.add(abs);
      }
    });

    return Array.from(urls);
  }

  /**
   * Extract all unique link URLs from anchor tags.
   */
  function extractLinks() {
    var urls = new Set();
    document.querySelectorAll('a[href]').forEach(function (a) {
      var abs = toAbsoluteURL(a.getAttribute('href'));
      if (abs) urls.add(abs);
    });
    return Array.from(urls);
  }

  /**
   * Extract main text content, preferring semantic containers.
   */
  function extractText() {
    var containers = document.querySelectorAll('article, main, [role="main"]');
    var root;

    if (containers.length > 0) {
      var maxLen = 0;
      containers.forEach(function (c) {
        var len = (c.textContent || '').length;
        if (len > maxLen) {
          maxLen = len;
          root = c;
        }
      });
    }

    if (!root) {
      root = document.body;
    }

    var clone = root.cloneNode(true);

    var removeTags = ['script', 'style', 'noscript', 'svg', 'nav', 'footer', 'header', 'aside', 'iframe', 'form', 'button', 'input', 'select', 'textarea'];
    removeTags.forEach(function (tag) {
      clone.querySelectorAll(tag).forEach(function (el) { el.remove(); });
    });

    var text = (clone.textContent || '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();

    if (text.length > MAX_TEXT_LENGTH) {
      text = text.substring(0, MAX_TEXT_LENGTH) + '\n\n[Truncated: content exceeded ' + MAX_TEXT_LENGTH + ' characters]';
    }

    return text;
  }

  /**
   * Extract meta tags — OG, Twitter, description, keywords, favicon.
   */
  function extractMeta() {
    var meta = {};

    // Standard meta tags
    var descEl = document.querySelector('meta[name="description"]');
    if (descEl) meta.description = descEl.getAttribute('content') || '';

    var keywordsEl = document.querySelector('meta[name="keywords"]');
    if (keywordsEl) meta.keywords = keywordsEl.getAttribute('content') || '';

    var authorEl = document.querySelector('meta[name="author"]');
    if (authorEl) meta.author = authorEl.getAttribute('content') || '';

    // Open Graph tags
    var ogTags = {};
    document.querySelectorAll('meta[property^="og:"]').forEach(function (el) {
      var prop = el.getAttribute('property').replace('og:', '');
      ogTags[prop] = el.getAttribute('content') || '';
    });
    if (Object.keys(ogTags).length > 0) meta.og = ogTags;

    // Twitter Card tags
    var twitterTags = {};
    document.querySelectorAll('meta[name^="twitter:"]').forEach(function (el) {
      var name = el.getAttribute('name').replace('twitter:', '');
      twitterTags[name] = el.getAttribute('content') || '';
    });
    if (Object.keys(twitterTags).length > 0) meta.twitter = twitterTags;

    // Favicon
    var favicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
    if (favicon) {
      var href = toAbsoluteURL(favicon.getAttribute('href'));
      if (href) meta.favicon = href;
    }

    // Canonical URL
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      meta.canonical = canonical.getAttribute('href') || '';
    }

    // Language
    var lang = document.documentElement.getAttribute('lang');
    if (lang) meta.language = lang;

    return meta;
  }

  // ── Execute and return results ──
  var result = {
    url: window.location.href,
    title: document.title || '',
    images: extractImages(),
    links: extractLinks(),
    text: extractText(),
    meta: extractMeta(),
    scrapedAt: new Date().toISOString()
  };

  return result;
})();
