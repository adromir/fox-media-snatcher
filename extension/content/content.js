/**
 * Fox Media Snatcher - Content Script
 * Scans page DOM for video, audio, and stream sources and notifies the background script.
 * @author Adromir
 */

(function () {
  // Avoid re-injection
  if (window.__fox_media_snatcher_injected__) return;
  window.__fox_media_snatcher_injected__ = true;

  function getPageTitle() {
    let title = document.title;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.content) {
      title = ogTitle.content;
    } else {
      const twitterTitle = document.querySelector('meta[name="twitter:title"]');
      if (twitterTitle && twitterTitle.content) {
        title = twitterTitle.content;
      }
    }
    return (title || '').trim();
  }

  function collectDomMedia() {
    const mediaSources = [];
    const seen = new Set();

    function addSrc(src, type) {
      if (!src || typeof src !== 'string') return;
      const clean = src.trim();
      if (clean && !clean.startsWith('blob:') && !clean.startsWith('data:') && !seen.has(clean)) {
        seen.add(clean);
        mediaSources.push({ src: clean, type });
      }
    }

    // Video tags
    const videos = document.querySelectorAll('video');
    videos.forEach(v => {
      if (v.src) addSrc(v.src, 'video');
      if (v.currentSrc) addSrc(v.currentSrc, 'video');
      v.querySelectorAll('source').forEach(s => addSrc(s.src, 'video'));
    });

    // Audio tags
    const audios = document.querySelectorAll('audio');
    audios.forEach(a => {
      if (a.src) addSrc(a.src, 'audio');
      if (a.currentSrc) addSrc(a.currentSrc, 'audio');
      a.querySelectorAll('source').forEach(s => addSrc(s.src, 'audio'));
    });

    return mediaSources;
  }

  function notifyBackground() {
    try {
      const title = getPageTitle();
      const domMedia = collectDomMedia();

      browser.runtime.sendMessage({
        action: 'PAGE_METADATA',
        title: title,
        url: window.location.href,
        domMedia: domMedia
      }).catch(() => {});
    } catch (e) {
      // Background might not be ready or page unloaded
    }
  }

  // Initial scan
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    notifyBackground();
  } else {
    document.addEventListener('DOMContentLoaded', notifyBackground, { once: true });
  }

  // Observer for dynamic media insertion (SPAs, lazy players)
  let scanTimeout = null;
  const observer = new MutationObserver((mutations) => {
    let hasMedia = false;
    for (const m of mutations) {
      if (m.addedNodes) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            const tag = node.tagName.toLowerCase();
            if (tag === 'video' || tag === 'audio' || tag === 'source' || node.querySelector('video, audio, source')) {
              hasMedia = true;
              break;
            }
          }
        }
      }
      if (hasMedia) break;
    }

    if (hasMedia) {
      clearTimeout(scanTimeout);
      scanTimeout = setTimeout(notifyBackground, 1000);
    }
  });

  try {
    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true
    });
  } catch (e) {}
})();
