/**
 * Fox Media Snatcher - Popup Controller
 * Manages media list rendering, direct downloads, and FFmpeg conversion workflows.
 * @author Adromir
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Apply i18n
  I18n.applyTranslations(document);

  let currentTabId = null;
  let selectedMediaItem = null;
  let pollInterval = null;

  // DOM Elements
  const tabMediaBtn = document.getElementById('tabMediaBtn');
  const tabTasksBtn = document.getElementById('tabTasksBtn');
  const mediaView = document.getElementById('mediaView');
  const tasksView = document.getElementById('tasksView');
  const mediaList = document.getElementById('mediaList');
  const taskList = document.getElementById('taskList');
  const emptyMediaNotice = document.getElementById('emptyMediaNotice');
  const emptyTasksNotice = document.getElementById('emptyTasksNotice');
  const mediaCountBadge = document.getElementById('mediaCountBadge');
  const taskCountBadge = document.getElementById('taskCountBadge');
  const btnClearMedia = document.getElementById('btnClearMedia');
  const btnOptions = document.getElementById('btnOptions');
  const companionBadge = document.getElementById('companionBadge');
  const companionText = document.getElementById('companionText');

  // Convert Modal Elements
  const convertModal = document.getElementById('convertModal');
  const btnModalClose = document.getElementById('btnModalClose');
  const btnModalCancel = document.getElementById('btnModalCancel');
  const btnModalStart = document.getElementById('btnModalStart');
  const inputFilename = document.getElementById('inputFilename');
  const selectFormat = document.getElementById('selectFormat');
  const selectPreset = document.getElementById('selectPreset');
  const qualityGroup = document.getElementById('qualityGroup');
  const modalCompanionWarning = document.getElementById('modalCompanionWarning');

  // Companion Modal Elements
  const companionModal = document.getElementById('companionModal');
  const btnCompanionClose = document.getElementById('btnCompanionClose');
  const btnCompanionDismiss = document.getElementById('btnCompanionDismiss');
  const btnTestCompanion = document.getElementById('btnTestCompanion');
  const companionTestResult = document.getElementById('companionTestResult');

  // Helper to create SVG icon safely
  function createSvgIcon(pathD, width = 12, height = 12) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    svg.appendChild(path);
    return svg;
  }

  // Get active tab
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs && tabs[0]) {
    currentTabId = tabs[0].id;
  }

  // Navigation Tabs switching
  tabMediaBtn.addEventListener('click', () => {
    tabMediaBtn.classList.add('active');
    tabTasksBtn.classList.remove('active');
    mediaView.classList.add('active');
    tasksView.classList.remove('active');
  });

  tabTasksBtn.addEventListener('click', () => {
    tabTasksBtn.classList.add('active');
    tabMediaBtn.classList.remove('active');
    tasksView.classList.add('active');
    mediaView.classList.remove('active');
  });

  // Settings button
  btnOptions.addEventListener('click', () => {
    if (browser.runtime.openOptionsPage) {
      browser.runtime.openOptionsPage();
    } else {
      window.open(browser.runtime.getURL('options/options.html'));
    }
  });

  // Clear media list
  btnClearMedia.addEventListener('click', async () => {
    if (currentTabId !== null) {
      await browser.runtime.sendMessage({ action: 'CLEAR_MEDIA', tabId: currentTabId });
      refreshState();
    }
  });

  // Companion badge click
  companionBadge.addEventListener('click', () => {
    companionModal.classList.remove('hidden');
    testCompanionStatus();
  });

  // Close modals
  btnModalClose.addEventListener('click', () => convertModal.classList.add('hidden'));
  btnModalCancel.addEventListener('click', () => convertModal.classList.add('hidden'));
  btnCompanionClose.addEventListener('click', () => companionModal.classList.add('hidden'));
  btnCompanionDismiss.addEventListener('click', () => companionModal.classList.add('hidden'));

  // Format change adjustments
  selectFormat.addEventListener('change', () => {
    const val = selectFormat.value;
    const isAudio = val.startsWith('mp3') || val === 'm4a' || val === 'flac' || val === 'opus';
    const isCopy = val === 'copy_mp4';
    if (isAudio || isCopy) {
      qualityGroup.style.display = 'none';
    } else {
      qualityGroup.style.display = 'flex';
    }
  });

  // Start conversion button
  btnModalStart.addEventListener('click', async () => {
    if (!selectedMediaItem) return;

    const formatVal = selectFormat.value;
    let targetFormat = 'mp4';
    let audioOnly = false;
    let audioBitrate = '192k';
    let preset = selectPreset.value;

    if (formatVal === 'copy_mp4') {
      targetFormat = 'mp4';
      preset = 'copy';
    } else if (formatVal === 'mp3_320') {
      targetFormat = 'mp3';
      audioOnly = true;
      audioBitrate = '320k';
    } else if (formatVal === 'mp3_192') {
      targetFormat = 'mp3';
      audioOnly = true;
      audioBitrate = '192k';
    } else if (formatVal === 'm4a' || formatVal === 'flac' || formatVal === 'opus') {
      targetFormat = formatVal;
      audioOnly = true;
    } else {
      targetFormat = formatVal;
    }

    const filename = (inputFilename.value || selectedMediaItem.title || 'media').trim();

    convertModal.classList.add('hidden');

    await browser.runtime.sendMessage({
      action: 'START_CONVERSION',
      mediaItem: selectedMediaItem,
      options: {
        format: targetFormat,
        preset: preset,
        audioOnly: audioOnly,
        audioBitrate: audioBitrate,
        filename: filename
      }
    });

    // Switch to tasks tab
    tabTasksBtn.click();
    refreshState();
  });

  // Test companion
  async function testCompanionStatus() {
    companionTestResult.className = 'test-result';
    companionTestResult.textContent = 'Testing connection to native host...';
    companionTestResult.style.display = 'block';

    const status = await browser.runtime.sendMessage({ action: 'CHECK_COMPANION' });
    updateCompanionUI(status);

    companionTestResult.textContent = '';
    if (status && status.connected) {
      companionTestResult.className = 'test-result success';
      const b = document.createElement('strong');
      b.textContent = 'Connected! ';
      companionTestResult.appendChild(b);
      companionTestResult.appendChild(document.createTextNode(`FFmpeg version: ${status.ffmpegVersion || 'Available'}`));
    } else {
      companionTestResult.className = 'test-result failure';
      const b = document.createElement('strong');
      b.textContent = 'Not connected: ';
      companionTestResult.appendChild(b);
      companionTestResult.appendChild(document.createTextNode(`${status ? (status.error || 'Host manifest not found') : 'Unknown error'}. Please run install_host.bat in the native-host directory.`));
    }
  }

  btnTestCompanion.addEventListener('click', testCompanionStatus);

  function updateCompanionUI(status) {
    if (!companionBadge || !companionText) return;

    if (status && status.connected) {
      companionBadge.className = 'companion-badge status-connected';
      companionText.textContent = 'FFmpeg OK';
      companionBadge.title = `FFmpeg detected: ${status.ffmpegVersion || 'Active'}`;
      modalCompanionWarning.classList.add('hidden');
    } else {
      companionBadge.className = 'companion-badge status-disconnected';
      companionText.textContent = 'Setup FFmpeg';
      companionBadge.title = 'Click to view FFmpeg Companion setup instructions';
      modalCompanionWarning.classList.remove('hidden');
    }
  }

  // Open Convert Dialog
  function openConvertDialog(item) {
    selectedMediaItem = item;
    inputFilename.value = item.title.replace(/\.[^/.]+$/, ""); // strip extension
    convertModal.classList.remove('hidden');
    selectFormat.dispatchEvent(new Event('change'));
  }

  // Render detected media items with safe DOM elements
  function renderMediaList(items) {
    mediaCountBadge.textContent = String(items.length);
    mediaList.textContent = '';

    if (items.length === 0) {
      emptyMediaNotice.style.display = 'flex';
      return;
    }

    emptyMediaNotice.style.display = 'none';

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'media-card';

      // Card Top
      const cardTop = document.createElement('div');
      cardTop.className = 'card-top';

      let tagClass = 'tag-video';
      if (item.type === 'audio') tagClass = 'tag-audio';
      else if (item.type === 'stream') tagClass = 'tag-stream';

      const tag = document.createElement('span');
      tag.className = `media-tag ${tagClass}`;
      tag.textContent = item.label || item.type;
      cardTop.appendChild(tag);

      const mediaInfo = document.createElement('div');
      mediaInfo.className = 'media-info';

      const titleEl = document.createElement('div');
      titleEl.className = 'media-title';
      titleEl.title = item.title;
      titleEl.textContent = item.title;
      mediaInfo.appendChild(titleEl);

      const metaRow = document.createElement('div');
      metaRow.className = 'media-meta';

      const sizeSpan = document.createElement('span');
      sizeSpan.className = 'meta-size';
      sizeSpan.textContent = item.sizeFormatted || 'Unknown size';
      metaRow.appendChild(sizeSpan);

      const dotSpan = document.createElement('span');
      dotSpan.textContent = '•';
      metaRow.appendChild(dotSpan);

      let domain = '';
      try {
        domain = new URL(item.url).hostname;
      } catch (e) {}

      const domainSpan = document.createElement('span');
      domainSpan.className = 'meta-domain';
      domainSpan.textContent = domain;
      metaRow.appendChild(domainSpan);

      mediaInfo.appendChild(metaRow);
      cardTop.appendChild(mediaInfo);
      card.appendChild(cardTop);

      // Card Actions
      const cardActions = document.createElement('div');
      cardActions.className = 'card-actions';

      // Download button
      const btnDl = document.createElement('button');
      btnDl.className = 'btn btn-primary btn-download';
      btnDl.title = I18n.getMessage('download');
      btnDl.appendChild(createSvgIcon('M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z'));
      const dlText = document.createElement('span');
      dlText.textContent = I18n.getMessage('download');
      btnDl.appendChild(dlText);
      btnDl.addEventListener('click', () => {
        browser.runtime.sendMessage({
          action: 'DOWNLOAD_DIRECT',
          url: item.url,
          filename: item.title
        });
      });
      cardActions.appendChild(btnDl);

      // Convert button
      const btnConv = document.createElement('button');
      btnConv.className = 'btn btn-secondary btn-convert';
      btnConv.title = I18n.getMessage('convert');
      btnConv.appendChild(createSvgIcon('M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z'));
      const convText = document.createElement('span');
      convText.textContent = I18n.getMessage('convert');
      btnConv.appendChild(convText);
      btnConv.addEventListener('click', () => {
        openConvertDialog(item);
      });
      cardActions.appendChild(btnConv);

      // Copy button
      const btnCopy = document.createElement('button');
      btnCopy.className = 'btn btn-outline btn-icon-only btn-copy';
      btnCopy.title = I18n.getMessage('copyUrl');
      const copySvg = createSvgIcon('M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z');
      btnCopy.appendChild(copySvg);

      btnCopy.addEventListener('click', async () => {
        await navigator.clipboard.writeText(item.url);
        btnCopy.title = I18n.getMessage('copied');
        btnCopy.textContent = '✓';
        setTimeout(() => {
          btnCopy.textContent = '';
          btnCopy.appendChild(createSvgIcon('M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z'));
          btnCopy.title = I18n.getMessage('copyUrl');
        }, 1200);
      });
      cardActions.appendChild(btnCopy);

      card.appendChild(cardActions);
      mediaList.appendChild(card);
    });
  }

  // Render tasks list with safe DOM elements
  function renderTaskList(tasks) {
    taskCountBadge.textContent = String(tasks.length);
    taskList.textContent = '';

    if (tasks.length === 0) {
      emptyTasksNotice.style.display = 'flex';
      return;
    }

    emptyTasksNotice.style.display = 'none';

    tasks.forEach(task => {
      const card = document.createElement('div');
      card.className = 'task-card';

      // Header
      const header = document.createElement('div');
      header.className = 'task-header';

      const titleEl = document.createElement('div');
      titleEl.className = 'task-title';
      titleEl.title = task.title;
      titleEl.textContent = `${task.title} [${(task.targetFormat || '').toUpperCase()}]`;
      header.appendChild(titleEl);

      let statusBadgeClass = 'status-active';
      let statusLabel = task.status;
      if (task.status === 'complete') {
        statusBadgeClass = 'status-finished';
        statusLabel = 'Complete';
      } else if (task.status === 'error' || task.status === 'cancelled') {
        statusBadgeClass = 'status-failed';
        statusLabel = task.status;
      }

      const badge = document.createElement('span');
      badge.className = `task-status-badge ${statusBadgeClass}`;
      badge.textContent = statusLabel;
      header.appendChild(badge);
      card.appendChild(header);

      // Progress bar
      const progContainer = document.createElement('div');
      progContainer.className = 'progress-container';
      const progBar = document.createElement('div');
      progBar.className = 'progress-bar';
      progBar.style.width = `${Math.min(100, task.percent || 0)}%`;
      progContainer.appendChild(progBar);
      card.appendChild(progContainer);

      // Meta row
      const metaRow = document.createElement('div');
      metaRow.className = 'task-meta';

      const speedSpan = document.createElement('span');
      speedSpan.textContent = `${task.percent || 0}% ${task.speed ? `(${task.speed})` : ''}`;
      metaRow.appendChild(speedSpan);

      const statusSpan = document.createElement('span');
      statusSpan.textContent = task.status === 'complete' ? 'Saved' : (task.error ? task.error : (task.status || 'Processing'));
      metaRow.appendChild(statusSpan);
      card.appendChild(metaRow);

      // Actions
      const cardActions = document.createElement('div');
      cardActions.className = 'card-actions';

      if (task.status === 'complete' && task.outputPath) {
        const btnOpen = document.createElement('button');
        btnOpen.className = 'btn btn-primary';
        btnOpen.appendChild(createSvgIcon('M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z'));
        const openText = document.createElement('span');
        openText.textContent = I18n.getMessage('openFolder');
        btnOpen.appendChild(openText);
        btnOpen.addEventListener('click', () => {
          browser.runtime.sendMessage({ action: 'OPEN_FOLDER', path: task.outputPath });
        });
        cardActions.appendChild(btnOpen);
      }

      if (task.status === 'converting' || task.status === 'starting') {
        const btnCancel = document.createElement('button');
        btnCancel.className = 'btn btn-danger';
        const cancelText = document.createElement('span');
        cancelText.textContent = I18n.getMessage('cancel');
        btnCancel.appendChild(cancelText);
        btnCancel.addEventListener('click', () => {
          browser.runtime.sendMessage({ action: 'CANCEL_TASK', taskId: task.taskId });
          refreshState();
        });
        cardActions.appendChild(btnCancel);
      }

      if (cardActions.children.length > 0) {
        card.appendChild(cardActions);
      }

      taskList.appendChild(card);
    });
  }

  // Main state refresh
  async function refreshState() {
    try {
      const state = await browser.runtime.sendMessage({
        action: 'GET_MEDIA_STATE',
        tabId: currentTabId
      });

      if (state) {
        renderMediaList(state.items || []);
        renderTaskList(state.tasks || []);
        if (state.companionStatus) {
          updateCompanionUI(state.companionStatus);
        }
      }
    } catch (e) {
      console.error('Error refreshing state:', e);
    }
  }

  // Initial load
  await refreshState();
  testCompanionStatus();

  // Poll state while popup is open for progress updates
  pollInterval = setInterval(refreshState, 1000);
  window.addEventListener('unload', () => {
    if (pollInterval) clearInterval(pollInterval);
  });
});
