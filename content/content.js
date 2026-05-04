/**
 * OneClick Scraper — Content Script
 * Injected programmatically into the active tab to extract page data.
 */
'use strict';

(function () {
  // Max text length to avoid performance issues on huge pages
  const MAX_TEXT_LENGTH = 500000;

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
    const urls = new Set();
    const imgs = document.querySelectorAll('img');

    imgs.forEach(function (img) {
      // Standard src
      var src = img.getAttribute('src');
      var abs = toAbsoluteURL(src);
      if (abs) urls.add(abs);

      // Lazy-load: data-src
      var dataSrc = img.getAttribute('data-src');
      abs = toAbsoluteURL(dataSrc);
      if (abs) urls.add(abs);

      // Lazy-load: data-lazy-src
      var dataLazy = img.getAttribute('data-lazy-src');
      abs = toAbsoluteURL(dataLazy);
      if (abs) urls.add(abs);

      // srcset — pick the largest available
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

    // Also check <source> inside <picture>
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

    // CSS background images on common containers
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
    // Try semantic content containers first
    var containers = document.querySelectorAll('article, main, [role="main"]');
    var root;

    if (containers.length > 0) {
      // Use the largest semantic container
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

    // Clone to avoid mutating the live DOM
    var clone = root.cloneNode(true);

    // Remove unwanted elements
    var removeTags = ['script', 'style', 'noscript', 'svg', 'nav', 'footer', 'header', 'aside', 'iframe', 'form', 'button', 'input', 'select', 'textarea'];
    removeTags.forEach(function (tag) {
      clone.querySelectorAll(tag).forEach(function (el) { el.remove(); });
    });

    // Get text and clean whitespace
    var text = (clone.textContent || '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();

    // Truncate if too large
    if (text.length > MAX_TEXT_LENGTH) {
      text = text.substring(0, MAX_TEXT_LENGTH) + '\n\n[Truncated: content exceeded ' + MAX_TEXT_LENGTH + ' characters]';
    }

    return text;
  }

  // ── Execute and return results ──
  var result = {
    url: window.location.href,
    title: document.title || '',
    images: extractImages(),
    links: extractLinks(),
    text: extractText()
  };

  // Return the result (used by chrome.scripting.executeScript)
  return result;
})();
