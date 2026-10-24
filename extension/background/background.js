/**
 * Fox Media Snatcher - Background Script
 * Handles network sniffing, media tracking, badge counter, and Native Messaging with FFmpeg host.
 * @author Adromir
 */

const NATIVE_HOST_NAME = 'foxmediasnatcher_host';

// Tab ID -> Array of detected media items
const tabMediaMap = new Map();
// Tab ID -> Page metadata { title, url }
const tabInfoMap = new Map();
// Task ID -> { taskId, url, title, format, percent, speed, status, outputPath, error, startTime }
const activeTasks = new Map();

// Companion status cache
let companionStatus = {
  tested: false,
  connected: false,
  ffmpegAvailable: false,
  ffmpegVersion: null,
  error: null
};

// Active Native Port for streaming communication
let activePort = null;

/**
 * Initialize or retrieve the persistent Native Messaging Port
 */
function getNativePort() {
  if (activePort) return activePort;

  try {
    activePort = browser.runtime.connectNative(NATIVE_HOST_NAME);

    activePort.onMessage.addListener((message) => {
      handleNativeMessage(message);
    });

    activePort.onDisconnect.addListener((p) => {
      const err = browser.runtime.lastError ? browser.runtime.lastError.message : 'Disconnected';
      console.warn('[Fox Media Snatcher] Native port disconnected:', err);
      companionStatus.connected = false;
      companionStatus.error = err;
      activePort = null;
    });

    return activePort;
  } catch (e) {
    console.error('[Fox Media Snatcher] Failed to connect native port:', e);
    activePort = null;
    return null;
  }
}

/**
 * Handle incoming messages from the native host
 */
function handleNativeMessage(msg) {
  if (!msg) return;

  if (msg.type === 'ping_response') {
    companionStatus.tested = true;
    companionStatus.connected = msg.success;
    companionStatus.ffmpegAvailable = msg.ffmpeg_available;
    companionStatus.ffmpegVersion = msg.ffmpeg_version;
    companionStatus.defaultDownloadDir = msg.default_download_dir;
    return;
  }

  const taskId = msg.taskId;
  if (!taskId || !activeTasks.has(taskId)) return;

  const task = activeTasks.get(taskId);

  if (msg.type === 'progress') {
    task.status = 'converting';
    task.percent = msg.percent !== undefined ? msg.percent : task.percent;
    task.speed = msg.speed || task.speed;
    task.fps = msg.fps;
    task.outTime = msg.outTime;
  } else if (msg.type === 'complete') {
    task.status = 'complete';
    task.percent = 100;
    task.outputPath = msg.outputPath;
    task.completedAt = Date.now();
  } else if (msg.type === 'error') {
    task.status = 'error';
    task.error = msg.error || 'Unknown conversion error';
    task.completedAt = Date.now();
  }
}

/**
 * Test companion connection
 */
async function checkCompanion() {
  try {
    const res = await browser.runtime.sendNativeMessage(NATIVE_HOST_NAME, { action: 'ping' });
    companionStatus = {
      tested: true,
      connected: res && res.success === true,
      ffmpegAvailable: res && res.ffmpeg_available === true,
      ffmpegVersion: res ? res.ffmpeg_version : null,
      defaultDownloadDir: res ? res.default_download_dir : null,
      error: null
    };
  } catch (err) {
    companionStatus = {
      tested: true,
      connected: false,
      ffmpegAvailable: false,
      ffmpegVersion: null,
      defaultDownloadDir: null,
      error: err.message || String(err)
    };
  }
  return companionStatus;
}

/**
 * Update the badge text for a tab
 */
function updateBadge(tabId) {
  if (tabId < 0) return;
  const items = tabMediaMap.get(tabId) || [];
  const count = items.length;
  const text = count > 0 ? String(count) : '';

  browser.browserAction.setBadgeText({ text, tabId });
  browser.browserAction.setBadgeBackgroundColor({ color: '#00838f', tabId });
}

/**
 * Check if a URL or header corresponds to downloadable media
 */
function inspectAndRegisterMedia(details) {
  const { url, tabId, responseHeaders, statusCode } = details;
  if (!url || tabId < 0 || statusCode >= 400) return;

  // Ignore data URLs, blob URLs, or internal browser URLs
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('about:') || url.startsWith('moz-extension:')) {
    return;
  }

  // Parse headers
  let contentType = '';
  let contentLength = 0;
  let contentDisposition = '';

  if (responseHeaders) {
    for (const h of responseHeaders) {
      const name = h.name.toLowerCase();
      if (name === 'content-type') contentType = h.value || '';
      else if (name === 'content-length') contentLength = parseInt(h.value, 10) || 0;
      else if (name === 'content-disposition') contentDisposition = h.value || '';
    }
  }

  // Determine media category
  const mediaInfo = Utils.categorizeMedia(url, contentType);
  if (!mediaInfo) return;

  // Filter out tiny snippets (less than 40KB unless it's a playlist file)
  if (mediaInfo.type !== 'stream' && contentLength > 0 && contentLength < 40960) {
    return;
  }

  // Ignore individual .ts or .m4s fragments if we are capturing the parent playlist
  // Only capture .ts if it's explicitly standalone
  const cleanUrl = url.split('?')[0].toLowerCase();
  if (cleanUrl.endsWith('.ts') || cleanUrl.endsWith('.m4s')) {
    // If we already have an m3u8 or mpd stream for this tab, skip recording every segment
    const existing = tabMediaMap.get(tabId) || [];
    if (existing.some(item => item.type === 'stream')) {
      return;
    }
  }

  let items = tabMediaMap.get(tabId);
  if (!items) {
    items = [];
    tabMediaMap.set(tabId, items);
  }

  // Check for duplicate URL
  const existingIndex = items.findIndex(item => item.url === url);
  if (existingIndex !== -1) {
    // Update existing item with size/mime if improved
    if (!items[existingIndex].contentLength && contentLength > 0) {
      items[existingIndex].contentLength = contentLength;
      items[existingIndex].sizeFormatted = Utils.formatBytes(contentLength);
    }
    return;
  }

  // Infer Title
  let title = '';
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename\*?=['"]?(?:UTF-8'')?([^;"\n]*)['"]?/i);
    if (filenameMatch && filenameMatch[1]) {
      title = decodeURIComponent(filenameMatch[1]);
    }
  }
  if (!title) {
    const fromUrl = Utils.extractFilenameFromUrl(url);
    if (fromUrl) {
      title = fromUrl;
    }
  }
  const tabInfo = tabInfoMap.get(tabId);
  if (!title && tabInfo && tabInfo.title) {
    title = tabInfo.title;
  }
  if (!title) {
    title = `media_${items.length + 1}.${mediaInfo.ext}`;
  }

  const mediaItem = {
    id: Utils.hashString(url + tabId),
    url: url,
    tabId: tabId,
    title: Utils.sanitizeFilename(title, 'media'),
    type: mediaInfo.type, // 'video' | 'audio' | 'stream'
    subtype: mediaInfo.subtype,
    ext: mediaInfo.ext,
    label: mediaInfo.label,
    mime: contentType,
    contentLength: contentLength,
    sizeFormatted: contentLength > 0 ? Utils.formatBytes(contentLength) : (mediaInfo.type === 'stream' ? 'Stream' : 'Unknown'),
    pageUrl: tabInfo ? tabInfo.url : '',
    detectedAt: Date.now()
  };

  items.push(mediaItem);
  updateBadge(tabId);
}

// Listen to web responses
browser.webRequest.onHeadersReceived.addListener(
  inspectAndRegisterMedia,
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// Tab lifecycle management
browser.tabs.onRemoved.addListener((tabId) => {
  tabMediaMap.delete(tabId);
  tabInfoMap.delete(tabId);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    tabMediaMap.delete(tabId);
    updateBadge(tabId);
  }
});

// Runtime messages from content scripts and popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action } = message;

  if (action === 'PAGE_METADATA') {
    // Sent by content script
    const tabId = sender.tab ? sender.tab.id : message.tabId;
    if (tabId !== undefined && tabId >= 0) {
      tabInfoMap.set(tabId, {
        title: message.title || '',
        url: message.url || ''
      });

      // Update titles for any media in this tab that have generic names
      const items = tabMediaMap.get(tabId);
      if (items && message.title) {
        items.forEach(item => {
          if (item.title.startsWith('media_') || item.title.startsWith('videoplayback')) {
            item.title = Utils.sanitizeFilename(`${message.title}.${item.ext}`, item.title);
          }
        });
      }

      // Check DOM media elements detected by content script
      if (Array.isArray(message.domMedia)) {
        message.domMedia.forEach(domItem => {
          if (domItem.src) {
            inspectAndRegisterMedia({
              url: domItem.src,
              tabId: tabId,
              responseHeaders: [],
              statusCode: 200
            });
          }
        });
      }
    }
    return Promise.resolve({ success: true });
  }

  if (action === 'GET_MEDIA_STATE') {
    const tabId = message.tabId;
    const items = tabMediaMap.get(tabId) || [];
    const tasks = Array.from(activeTasks.values()).sort((a, b) => (b.startTime || 0) - (a.startTime || 0));

    return Promise.resolve({
      items,
      tasks,
      companionStatus
    });
  }

  if (action === 'CLEAR_MEDIA') {
    const tabId = message.tabId;
    if (tabId !== undefined) {
      tabMediaMap.delete(tabId);
      updateBadge(tabId);
    }
    return Promise.resolve({ success: true });
  }

  if (action === 'CHECK_COMPANION') {
    return checkCompanion();
  }

  if (action === 'DOWNLOAD_DIRECT') {
    const { url, filename } = message;
    return browser.downloads.download({
      url: url,
      filename: filename || undefined,
      saveAs: true
    }).then(downloadId => {
      return { success: true, downloadId };
    }).catch(err => {
      return { success: false, error: err.message };
    });
  }

  if (action === 'START_CONVERSION') {
    const { mediaItem, options } = message;
    const taskId = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    const task = {
      taskId: taskId,
      url: mediaItem.url,
      title: options.filename || mediaItem.title || 'media',
      targetFormat: options.format || 'mp4',
      preset: options.preset || 'fast',
      audioOnly: options.audioOnly || false,
      percent: 0,
      speed: '0x',
      status: 'starting',
      outputPath: null,
      error: null,
      startTime: Date.now()
    };

    activeTasks.set(taskId, task);

    // Get tab URL for referer header
    const tabInfo = tabInfoMap.get(mediaItem.tabId);
    const referer = tabInfo ? tabInfo.url : (mediaItem.pageUrl || '');

    const port = getNativePort();
    if (!port) {
      task.status = 'error';
      task.error = 'Native FFmpeg Companion not connected. Please install and register the companion app.';
      return Promise.resolve({ success: false, taskId, error: task.error });
    }

    port.postMessage({
      action: 'convert',
      taskId: taskId,
      url: mediaItem.url,
      headers: {
        'Referer': referer,
        'User-Agent': navigator.userAgent
      },
      format: options.format || 'mp4',
      preset: options.preset || 'fast',
      audioOnly: options.audioOnly || false,
      audioBitrate: options.audioBitrate || '320k',
      filename: options.filename || mediaItem.title,
      outputDir: options.outputDir || ''
    });

    return Promise.resolve({ success: true, taskId });
  }

  if (action === 'CANCEL_TASK') {
    const { taskId } = message;
    if (activeTasks.has(taskId)) {
      const task = activeTasks.get(taskId);
      task.status = 'cancelled';
      const port = getNativePort();
      if (port) {
        port.postMessage({ action: 'cancel', taskId });
      }
    }
    return Promise.resolve({ success: true });
  }

  if (action === 'OPEN_FOLDER') {
    const { path } = message;
    const port = getNativePort();
    if (port) {
      port.postMessage({ action: 'open_folder', path });
      return Promise.resolve({ success: true });
    }
    return Promise.resolve({ success: false, error: 'Port not available' });
  }

  return false;
});

// Periodic test of companion status at startup
setTimeout(() => {
  checkCompanion().catch(() => {});
}, 1500);
