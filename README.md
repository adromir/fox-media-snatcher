# Fox Media Snatcher 🦊🎬🎵

[![Firefox Extension](https://img.shields.io/badge/Firefox-WebExtension%20MV2-FF7139?style=flat-square&logo=firefox-browser&logoColor=white)](https://www.mozilla.org/firefox/)
[![FFmpeg Compatible](https://img.shields.io/badge/FFmpeg-9.0%2B-007808?style=flat-square&logo=ffmpeg&logoColor=white)](https://ffmpeg.org/)
[![Python Native Host](https://img.shields.io/badge/Python-3.8%2B-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![i18n: EN / DE](https://img.shields.io/badge/i18n-English%20%7C%20German-blue?style=flat-square)](#internationalization)

> **A powerful, lightweight media snatcher and converter for Mozilla Firefox, with built-in native FFmpeg stream conversion and audio extraction.**

---

## 🌟 Overview

**Fox Media Snatcher** is a browser extension tailored specifically for Mozilla Firefox that detects audio, video, and streaming playlists (HLS/DASH) across web pages. It combines the simplicity of direct browser downloads with the raw power of a local **FFmpeg** companion app via Firefox's Native Messaging API.

Whether you need to save a quick MP4 video file or capture fragmented HLS (`.m3u8`) and DASH (`.mpd`) video streams and merge/convert them directly into high-quality MP4, MKV, MP3, or FLAC — **Fox Media Snatcher** handles it seamlessly.

---

## ⚡ Key Advantages

- 🚀 **Zero Cloud Dependency**: Conversions happen entirely on your own computer with your local FFmpeg binary. No waiting in third-party queues, no bandwidth limits, no privacy concerns.
- 🎯 **Advanced Stream Detection**: Captures HLS playlists (`.m3u8`) and DASH manifests (`.mpd`), forwarding session authentication headers (`Referer`, `User-Agent`) to FFmpeg so protected streams download without HTTP 403 Forbidden errors.
- 🔄 **Ultra-Fast Stream Copy (Remux)**: Remux streams without re-encoding to preserve 100% of the original video quality while completing downloads in seconds.
- 🎧 **Audio Extraction**: Instantly extract audio from any video stream to MP3 (320k or 192k), AAC/M4A, Lossless FLAC, or Opus.
- 🛡️ **Clean & Privacy-Respecting**: Zero tracking, zero telemetry, no ads, and no watermarks. Fully compliant with Mozilla's `data_collection_permissions` (0 data collected).
- 🌍 **Bilingual (i18n)**: Full native support for **English** and **German**.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Firefox Browser                      │
│                                                        │
│   Web Page ──────► Content Script (DOM media scan)     │
│       │                      │                         │
│   Network Traffic            ▼                         │
│       └──────────► Background Sniffer (webRequest)    │
│                              │                         │
│                              ▼                         │
│                         Popup UI                       │
│                 (Fox Media Snatcher Panel)             │
└──────────────────────────────┬─────────────────────────┘
                               │ Native Messaging (stdio)
                               ▼
┌────────────────────────────────────────────────────────┐
│                Native Companion Host                   │
│                                                        │
│   foxmediasnatcher_host.py (Python stdio JSON)         │
│                              │                         │
│                              ▼                         │
│   Local FFmpeg Binary ──► Direct Stream Merging &      │
│   (ffmpeg.exe)            Format Conversion            │
└────────────────────────────────────────────────────────┘
```

---

## 📦 Project Structure

```
e:/media-download/
├── extension/                       # WebExtension Files
│   ├── manifest.json                # Extension Manifest (Firefox MV2)
│   ├── _locales/                    # Multi-language strings
│   │   ├── en/messages.json         # English
│   │   └── de/messages.json         # German
│   ├── icons/                       # Extension action icons (16, 32, 48, 128)
│   ├── background/                  # Background worker & request sniffer
│   │   └── background.js
│   ├── content/                     # DOM media scanner & title resolver
│   │   └── content.js
│   ├── popup/                       # Main Toolbar UI
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── options/                     # Settings & Configuration
│   │   ├── options.html
│   │   ├── options.css
│   │   └── options.js
│   └── shared/                      # Utility and i18n helpers
│       ├── i18n.js
│       └── utils.js
├── native-host/                     # FFmpeg Companion Application
│   ├── foxmediasnatcher_host.py     # Native messaging server (Python)
│   ├── foxmediasnatcher_host.bat    # Windows launcher
│   ├── foxmediasnatcher_host.json   # Mozilla Native Host Manifest
│   ├── install_host.bat             # 1-Click Windows Registry installer
│   ├── uninstall_host.bat           # Registry uninstaller
│   └── install_host.ps1             # PowerShell installer alternative
├── dist/                            # Ready-to-install packages
│   ├── fox-media-snatcher-1.0.0.zip # AMO uploadable archive
│   └── fox-media-snatcher-1.0.0.xpi # Direct install XPI package
└── README.md
```

---

## 🚀 Installation & Setup

### Step 1: Install the FFmpeg Companion Host

The companion host connects Firefox to your local `ffmpeg.exe` installation.

1. Open the [native-host](file:///e:/media-download/native-host) folder.
2. Double-click **`install_host.bat`** (or right-click `install_host.ps1` and select *Run with PowerShell*).
3. The script will:
   - Configure the absolute path in `foxmediasnatcher_host.json`.
   - Register the host in the Windows Registry under `HKCU\Software\Mozilla\NativeMessagingHosts\foxmediasnatcher_host`.
   - Verify that `python` and `ffmpeg` are available on your system.

### Step 2: Load the Extension in Firefox

#### Option A: Load Temporary Add-on (Recommended for Testing & Development)
1. Open Mozilla Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **"Load Temporary Add-on..."** (Temporäres Add-on laden...).
3. Select the [manifest.json](file:///e:/media-download/extension/manifest.json) inside `e:/media-download/extension/` (or select `dist/fox-media-snatcher-1.0.0.zip`).
4. The **Fox Media Snatcher** icon will appear on your toolbar!

#### Option B: Drag and Drop `.xpi`
1. Open Firefox.
2. Drag and drop [dist/fox-media-snatcher-1.0.0.xpi](file:///e:/media-download/dist/fox-media-snatcher-1.0.0.xpi) into any Firefox window.

---

## 💡 How to Use

1. **Browse to any webpage** containing audio or video (e.g., YouTube, Vimeo, Twitch, news sites, podcasts).
2. **Start playback**: If the video is loaded on-demand, pressing play allows Fox Media Snatcher to capture the stream playlist or media requests.
3. **Open Fox Media Snatcher**: Click the Fox Media Snatcher icon in the Firefox toolbar. The badge displays the number of detected streams.
4. **Choose an Action**:
   - **Download (Direct)**: Downloads direct files immediately through Firefox's download manager.
   - **Convert with FFmpeg**: Opens the conversion drawer:
     - *Format*: MP4, MP4 (Stream Copy), MKV, WebM, MP3 (320k/192k), M4A, FLAC, Opus.
     - *Preset*: Fast, High Quality, or Ultra Fast.
     - *File Name*: Customize output filename.
   - **Show in Folder**: Once conversion finishes, click the button to open Windows Explorer with the saved media selected!

---

## ⚙️ Configuration & Options

Click the Settings gear icon in the popup or go to Firefox *Add-ons Manager -> Fox Media Snatcher -> Options* to configure:
- **Custom FFmpeg Path**: Specify a custom binary location if FFmpeg is not in your system PATH.
- **Output Directory**: Configure a dedicated output folder (defaults to your Windows `Downloads` directory).
- **Default Format & Preset**: Set your favorite default conversion profile.
- **Minimum File Size Filter**: Automatically filter out ads, tracking pixels, and short audio snippets.

---

## 🌐 Internationalization (i18n)

Fox Media Snatcher comes with native bilingual support:
- 🇬🇧 **English** (`en`)
- 🇩🇪 **German** (`de`)

The extension automatically adapts to your Firefox display language.

---

## ⚠️ Disclaimer

Fox Media Snatcher is intended for downloading media for personal use, archiving, and offline access in compliance with local copyright laws. Please respect copyright regulations and the terms of service of the respective website owners.

---

## 📄 License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).

**Author:** [Adromir](https://github.com/adromir)  
**Website:** [https://github.com/adromir](https://github.com/adromir)
