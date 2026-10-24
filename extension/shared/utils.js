/**
 * Utility functions for Fox Media Snatcher
 * @author Adromir
 */

const Utils = {
  /**
   * Format bytes into human-readable string (e.g. 14.5 MB)
   */
  formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes <= 0 || isNaN(bytes)) return null;
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  },

  /**
   * Sanitize a string for safe filesystem filename
   */
  sanitizeFilename(name, fallback = 'media') {
    if (!name || typeof name !== 'string') return fallback;
    // Remove query parameters or path slashes
    let clean = name.replace(/[\\/:*?"<>|]/g, '_')
                    .replace(/[\r\n\t]+/g, ' ')
                    .trim();
    if (!clean) return fallback;
    if (clean.length > 120) {
      clean = clean.substring(0, 120).trim();
    }
    return clean;
  },

  /**
   * Extract filename and extension from a URL
   */
  extractFilenameFromUrl(urlStr) {
    try {
      const url = new URL(urlStr);
      const pathname = url.pathname;
      const lastSegment = pathname.substring(pathname.lastIndexOf('/') + 1);
      if (lastSegment && lastSegment.includes('.')) {
        return decodeURIComponent(lastSegment);
      }
    } catch (e) {
      // URL parsing failed, fallback
    }
    return null;
  },

  /**
   * Determine media category (video, audio, stream) and extension
   */
  categorizeMedia(urlStr, mime = '') {
    const mimeLower = (mime || '').toLowerCase();
    const cleanUrl = (urlStr || '').split('?')[0].toLowerCase();

    // HLS Stream
    if (
      mimeLower.includes('vnd.apple.mpegurl') ||
      mimeLower.includes('application/x-mpegurl') ||
      cleanUrl.endsWith('.m3u8')
    ) {
      return { type: 'stream', subtype: 'hls', ext: 'm3u8', label: 'HLS Stream' };
    }

    // DASH Stream
    if (
      mimeLower.includes('dash+xml') ||
      cleanUrl.endsWith('.mpd')
    ) {
      return { type: 'stream', subtype: 'dash', ext: 'mpd', label: 'DASH Stream' };
    }

    // Direct Video
    if (mimeLower.startsWith('video/') || /\.(mp4|webm|mkv|flv|avi|mov|m4v|3gp|ts)$/i.test(cleanUrl)) {
      let ext = 'mp4';
      if (mimeLower.includes('webm') || cleanUrl.endsWith('.webm')) ext = 'webm';
      else if (mimeLower.includes('x-matroska') || cleanUrl.endsWith('.mkv')) ext = 'mkv';
      else if (mimeLower.includes('flv') || cleanUrl.endsWith('.flv')) ext = 'flv';
      else if (cleanUrl.endsWith('.mov')) ext = 'mov';
      else if (cleanUrl.endsWith('.avi')) ext = 'avi';
      return { type: 'video', subtype: ext, ext: ext, label: ext.toUpperCase() };
    }

    // Direct Audio
    if (mimeLower.startsWith('audio/') || /\.(mp3|m4a|aac|ogg|wav|flac|opus|weba)$/i.test(cleanUrl)) {
      let ext = 'mp3';
      if (mimeLower.includes('ogg') || cleanUrl.endsWith('.ogg')) ext = 'ogg';
      else if (mimeLower.includes('wav') || cleanUrl.endsWith('.wav')) ext = 'wav';
      else if (mimeLower.includes('flac') || cleanUrl.endsWith('.flac')) ext = 'flac';
      else if (mimeLower.includes('aac') || cleanUrl.endsWith('.aac')) ext = 'aac';
      else if (mimeLower.includes('mp4') || mimeLower.includes('m4a') || cleanUrl.endsWith('.m4a')) ext = 'm4a';
      else if (mimeLower.includes('opus') || cleanUrl.endsWith('.opus')) ext = 'opus';
      return { type: 'audio', subtype: ext, ext: ext, label: ext.toUpperCase() };
    }

    return null;
  },

  /**
   * Generate simple hash code for URL deduplication
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36);
  }
};

if (typeof module !== 'undefined') {
  module.exports = Utils;
}
