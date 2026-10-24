/**
 * Fox Media Snatcher - Options Controller
 * @author Adromir
 */

document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('statusDot');
  const statusMessage = document.getElementById('statusMessage');
  const btnCheckCompanion = document.getElementById('btnCheckCompanion');
  const customFfmpegPath = document.getElementById('customFfmpegPath');
  const customOutputDir = document.getElementById('customOutputDir');
  const defaultFormat = document.getElementById('defaultFormat');
  const defaultPreset = document.getElementById('defaultPreset');
  const minSizeFilter = document.getElementById('minSizeFilter');
  const detectStreams = document.getElementById('detectStreams');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const saveStatus = document.getElementById('saveStatus');

  // Load existing settings
  const stored = await browser.storage.local.get({
    customFfmpegPath: '',
    customOutputDir: '',
    defaultFormat: 'mp4',
    defaultPreset: 'fast',
    minSizeFilter: 50,
    detectStreams: true
  });

  customFfmpegPath.value = stored.customFfmpegPath;
  customOutputDir.value = stored.customOutputDir;
  defaultFormat.value = stored.defaultFormat;
  defaultPreset.value = stored.defaultPreset;
  minSizeFilter.value = stored.minSizeFilter;
  detectStreams.checked = stored.detectStreams;

  // Check Companion
  async function checkCompanion() {
    statusDot.className = 'status-dot';
    statusMessage.textContent = 'Checking companion connection...';

    const status = await browser.runtime.sendMessage({ action: 'CHECK_COMPANION' });
    if (status && status.connected) {
      statusDot.className = 'status-dot connected';
      statusMessage.textContent = `Connected! FFmpeg version: ${status.ffmpegVersion || 'Available'}`;
    } else {
      statusDot.className = 'status-dot disconnected';
      statusMessage.textContent = `Not connected (${status ? status.error : 'Companion not registered'}). Run install_host.bat`;
    }
  }

  btnCheckCompanion.addEventListener('click', checkCompanion);
  checkCompanion();

  // Save Settings
  btnSaveSettings.addEventListener('click', async () => {
    await browser.storage.local.set({
      customFfmpegPath: customFfmpegPath.value.trim(),
      customOutputDir: customOutputDir.value.trim(),
      defaultFormat: defaultFormat.value,
      defaultPreset: defaultPreset.value,
      minSizeFilter: parseInt(minSizeFilter.value, 10) || 50,
      detectStreams: detectStreams.checked
    });

    saveStatus.classList.add('visible');
    setTimeout(() => {
      saveStatus.classList.remove('visible');
    }, 2500);
  });
});
