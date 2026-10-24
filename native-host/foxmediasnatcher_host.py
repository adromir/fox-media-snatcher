#!/usr/bin/env python3
"""
Fox Media Snatcher - Native Messaging Companion Host
Enables Firefox to communicate with local FFmpeg for downloading and converting media.
Author: Adromir
"""

import sys
import os
import json
import struct
import subprocess
import threading
import shutil
import re
from pathlib import Path

# Active ffmpeg processes: taskId -> subprocess.Popen instance
ACTIVE_PROCESSES = {}
ACTIVE_PROCESSES_LOCK = threading.Lock()

def get_default_download_dir():
    """Retrieve standard user Downloads directory on Windows/Linux/macOS."""
    if os.name == 'nt':
        import winreg
        try:
            # Query standard Windows shell folder for Downloads
            sub_key = r"Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders"
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, sub_key) as key:
                down_dir, _ = winreg.QueryValueEx(key, "{374DE290-123F-4565-9164-39C4925E467B}")
                if os.path.isdir(down_dir):
                    return down_dir
        except Exception:
            pass
    # Fallback to home/Downloads
    home_downloads = Path.home() / "Downloads"
    if home_downloads.exists():
        return str(home_downloads)
    return str(Path.home())

def read_message():
    """Read a 32-bit length-prefixed JSON message from stdin."""
    try:
        raw_length = sys.stdin.buffer.read(4)
        if len(raw_length) < 4:
            return None
        msg_length = struct.unpack('<I', raw_length)[0]
        payload = sys.stdin.buffer.read(msg_length)
        if len(payload) < msg_length:
            return None
        return json.loads(payload.decode('utf-8'))
    except Exception:
        return None

def send_message(msg):
    """Send a 32-bit length-prefixed JSON message to stdout."""
    try:
        payload = json.dumps(msg).encode('utf-8')
        sys.stdout.buffer.write(struct.pack('<I', len(payload)))
        sys.stdout.buffer.write(payload)
        sys.stdout.buffer.flush()
    except Exception:
        pass

def check_ffmpeg(custom_path=None):
    """Check if ffmpeg is available and retrieve its version."""
    ffmpeg_bin = custom_path.strip() if custom_path and custom_path.strip() else 'ffmpeg'
    try:
        proc = subprocess.run([ffmpeg_bin, '-version'], capture_output=True, text=True, check=True)
        first_line = proc.stdout.splitlines()[0] if proc.stdout else 'ffmpeg'
        return True, first_line, ffmpeg_bin
    except Exception as e:
        return False, str(e), ffmpeg_bin

def run_conversion_worker(task_id, url, headers, target_format, preset, audio_only, audio_bitrate, filename, output_dir, custom_ffmpeg):
    """Background thread worker to execute ffmpeg command and report progress."""
    try:
        ok, ver, ffmpeg_bin = check_ffmpeg(custom_ffmpeg)
        if not ok:
            send_message({
                "type": "error",
                "taskId": task_id,
                "error": f"FFmpeg not available: {ver}"
            })
            return

        # Prepare output directory
        dest_dir = Path(output_dir) if output_dir and os.path.isdir(output_dir) else Path(get_default_download_dir())
        dest_dir.mkdir(parents=True, exist_ok=True)

        # Sanitize filename
        safe_name = re.sub(r'[\\/:*?"<>|]', '_', filename).strip() or "media"
        # Determine extension
        ext_map = {
            'mp4': '.mp4',
            'mkv': '.mkv',
            'webm': '.webm',
            'mp3': '.mp3',
            'm4a': '.m4a',
            'flac': '.flac',
            'opus': '.opus'
        }
        ext = ext_map.get(target_format.lower(), f".{target_format.lower()}")
        
        # Avoid filename collisions
        candidate = dest_dir / f"{safe_name}{ext}"
        counter = 1
        while candidate.exists():
            candidate = dest_dir / f"{safe_name} ({counter}){ext}"
            counter += 1
        output_path = candidate

        # Build FFmpeg command arguments
        cmd = [ffmpeg_bin, '-y']

        # Add custom HTTP headers if present (Referer, User-Agent)
        if headers and isinstance(headers, dict):
            header_lines = []
            if 'Referer' in headers and headers['Referer']:
                header_lines.append(f"Referer: {headers['Referer']}")
            if 'User-Agent' in headers and headers['User-Agent']:
                header_lines.append(f"User-Agent: {headers['User-Agent']}")
            if header_lines:
                combined_headers = "\r\n".join(header_lines) + "\r\n"
                cmd.extend(['-headers', combined_headers])

        # Input URL
        cmd.extend(['-i', url])

        # Target encoding options
        if audio_only or target_format in ['mp3', 'm4a', 'flac', 'opus']:
            cmd.append('-vn')  # No video
            if target_format == 'mp3':
                cmd.extend(['-c:a', 'libmp3lame', '-b:a', audio_bitrate or '320k'])
            elif target_format == 'm4a':
                cmd.extend(['-c:a', 'aac', '-b:a', audio_bitrate or '256k'])
            elif target_format == 'flac':
                cmd.extend(['-c:a', 'flac'])
            elif target_format == 'opus':
                cmd.extend(['-c:a', 'libopus', '-b:a', audio_bitrate or '128k'])
            else:
                cmd.extend(['-c:a', 'copy'])
        elif preset == 'copy':
            # Stream copy (super fast remux)
            cmd.extend(['-c', 'copy'])
        else:
            # Video re-encode
            if target_format == 'webm':
                cmd.extend(['-c:v', 'libvpx-vp9', '-crf', '28', '-b:v', '0', '-c:a', 'libopus'])
            else:
                cmd.extend(['-c:v', 'libx264', '-preset', preset or 'fast', '-crf', '22', '-c:a', 'aac', '-b:a', '192k'])

        # Progress reporting flag
        cmd.extend(['-progress', 'pipe:1', str(output_path)])

        # Launch FFmpeg process with hidden window on Windows
        startupinfo = None
        if os.name == 'nt':
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            startupinfo.wShowWindow = subprocess.SW_HIDE

        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            startupinfo=startupinfo
        )

        with ACTIVE_PROCESSES_LOCK:
            ACTIVE_PROCESSES[task_id] = proc

        # Read progress from stdout
        speed_val = "1.0x"
        out_time_ms = 0

        for line in proc.stdout:
            line = line.strip()
            if not line:
                continue
            if line.startswith('out_time_ms='):
                try:
                    out_time_ms = int(line.split('=', 1)[1])
                except ValueError:
                    pass
            elif line.startswith('speed='):
                speed_val = line.split('=', 1)[1].strip()
            elif line.startswith('progress='):
                send_message({
                    "type": "progress",
                    "taskId": task_id,
                    "percent": None,
                    "speed": speed_val,
                    "outTime": f"{out_time_ms // 1000000}s"
                })

        proc.wait()

        with ACTIVE_PROCESSES_LOCK:
            ACTIVE_PROCESSES.pop(task_id, None)

        if proc.returncode == 0:
            send_message({
                "type": "complete",
                "taskId": task_id,
                "outputPath": str(output_path),
                "success": True
            })
        else:
            stderr_tail = proc.stderr.read()[-300:] if proc.stderr else "Unknown error"
            send_message({
                "type": "error",
                "taskId": task_id,
                "error": f"FFmpeg exited with code {proc.returncode}: {stderr_tail}"
            })

    except Exception as e:
        with ACTIVE_PROCESSES_LOCK:
            ACTIVE_PROCESSES.pop(task_id, None)
        send_message({
            "type": "error",
            "taskId": task_id,
            "error": str(e)
        })

def handle_message(msg):
    """Route incoming request messages."""
    action = msg.get("action")

    if action == "ping":
        custom_ffmpeg = msg.get("customFfmpegPath")
        ok, ver, bin_path = check_ffmpeg(custom_ffmpeg)
        send_message({
            "type": "ping_response",
            "success": True,
            "ffmpeg_available": ok,
            "ffmpeg_version": ver if ok else None,
            "default_download_dir": get_default_download_dir()
        })

    elif action == "convert":
        task_id = msg.get("taskId")
        url = msg.get("url")
        headers = msg.get("headers", {})
        target_format = msg.get("format", "mp4")
        preset = msg.get("preset", "fast")
        audio_only = msg.get("audioOnly", False)
        audio_bitrate = msg.get("audioBitrate", "320k")
        filename = msg.get("filename", "media")
        output_dir = msg.get("outputDir", "")
        custom_ffmpeg = msg.get("customFfmpegPath", "")

        t = threading.Thread(
            target=run_conversion_worker,
            args=(task_id, url, headers, target_format, preset, audio_only, audio_bitrate, filename, output_dir, custom_ffmpeg),
            daemon=True
        )
        t.start()

    elif action == "cancel":
        task_id = msg.get("taskId")
        with ACTIVE_PROCESSES_LOCK:
            proc = ACTIVE_PROCESSES.get(task_id)
            if proc:
                try:
                    proc.terminate()
                except Exception:
                    pass

    elif action == "open_folder":
        path = msg.get("path")
        if path and os.name == 'nt':
            try:
                norm = os.path.normpath(path)
                if os.path.exists(norm):
                    subprocess.Popen(['explorer.exe', f'/select,{norm}'])
                else:
                    parent = os.path.dirname(norm)
                    if os.path.exists(parent):
                        subprocess.Popen(['explorer.exe', parent])
            except Exception:
                pass

def main():
    while True:
        msg = read_message()
        if msg is None:
            break
        handle_message(msg)

if __name__ == "__main__":
    main()
