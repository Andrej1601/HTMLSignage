const { app, BrowserWindow, globalShortcut, session, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
let config = { serverUrl: 'http://localhost:5173', kioskMode: true, hideCursor: true, devMode: false };

try {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  config = { ...config, ...JSON.parse(raw) };
} catch {
  console.warn('[Kiosk] config.json nicht gefunden – Standardwerte werden verwendet.');
}

const DISPLAY_URL = `${config.serverUrl.replace(/\/$/, '')}/display`;
const HEALTH_URL = `${config.serverUrl.replace(/\/$/, '')}/health`;
const OFFLINE_PATH = path.join(__dirname, 'offline.html');

// ---------------------------------------------------------------------------
// Retry / Watchdog helpers
// ---------------------------------------------------------------------------

const INITIAL_RETRY_MS = 3000;
const MAX_RETRY_MS = 30000;
const WATCHDOG_INTERVAL_MS = 15000;
const PERIODIC_RELOAD_MS = 12 * 60 * 60 * 1000; // 12 hours – prevents slow memory leaks

let retryMs = INITIAL_RETRY_MS;
let retryTimer = null;

function checkServerReachable(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 5000 }, (res) => {
      res.resume();
      resolve(res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function scheduleReload(delayMs) {
  if (retryTimer) {
    clearTimeout(retryTimer);
  }
  retryTimer = setTimeout(() => {
    retryTimer = null;
    loadDisplay();
  }, delayMs);
}

// ---------------------------------------------------------------------------
// Main window
// ---------------------------------------------------------------------------

let mainWindow = null;
let watchdogInterval = null;
let periodicReloadTimer = null;
let isOffline = false;
let powerSaveId = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    fullscreen: true,
    kiosk: config.kioskMode,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: config.devMode,
    },
  });

  // ---- Crash Recovery ----
  mainWindow.webContents.on('crashed', (_event, killed) => {
    console.error(`[Kiosk] Renderer ${killed ? 'killed' : 'crashed'} – Neustart in 3s`);
    scheduleReload(3000);
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.warn('[Kiosk] Seite reagiert nicht – Neustart in 5s');
    scheduleReload(5000);
  });

  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    if (code === -3) return; // Aborted – ignorieren (z.B. bei schnellem Reload)
    console.warn(`[Kiosk] Laden fehlgeschlagen (${code}: ${desc}) – Retry in ${retryMs}ms`);
    showOffline();
    scheduleReload(retryMs);
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
  });

  // ---- Sicherheit ----
  // Kontextmenü deaktivieren
  mainWindow.webContents.on('context-menu', (e) => e.preventDefault());

  // Neue Fenster blockieren
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // ---- Cursor & CSS-Injection ----
  mainWindow.webContents.on('did-finish-load', () => {
    if (config.hideCursor) {
      mainWindow.webContents.insertCSS('* { cursor: none !important; }');
    }
    if (!isOffline) {
      retryMs = INITIAL_RETRY_MS; // Reset backoff bei erfolgreichem Laden
    }
  });

  // ---- Keyboard Shortcuts blockieren (Kiosk-Modus) ----
  if (config.kioskMode) {
    mainWindow.webContents.on('before-input-event', (_event, input) => {
      // Blockiere: Alt+F4, Alt+Tab, Ctrl+W, Ctrl+Q, Ctrl+N, F11
      const blocked =
        (input.alt && input.key === 'F4') ||
        (input.alt && input.key === 'Tab') ||
        (input.control && input.key === 'w') ||
        (input.control && input.key === 'q') ||
        (input.control && input.key === 'n') ||
        input.key === 'F11';

      if (blocked) {
        _event.preventDefault();
      }
    });
  }

  loadDisplay();
  startWatchdog();
  startPeriodicReload();
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

function loadDisplay() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  console.log(`[Kiosk] Lade ${DISPLAY_URL}`);
  isOffline = false;
  mainWindow.loadURL(DISPLAY_URL).catch(() => {
    showOffline();
  });
}

function showOffline() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (isOffline) return; // Bereits auf Offline-Seite
  isOffline = true;
  mainWindow.loadFile(OFFLINE_PATH).catch(() => {});
}

// ---------------------------------------------------------------------------
// Network Watchdog (checks every 15s)
// ---------------------------------------------------------------------------

function startWatchdog() {
  if (watchdogInterval) clearInterval(watchdogInterval);

  watchdogInterval = setInterval(async () => {
    const reachable = await checkServerReachable(HEALTH_URL);

    if (!reachable && !isOffline) {
      console.warn('[Kiosk] Server nicht erreichbar – wechsle zu Offline-Seite');
      showOffline();
    } else if (reachable && isOffline) {
      console.log('[Kiosk] Server wieder erreichbar – lade Display');
      retryMs = INITIAL_RETRY_MS;
      loadDisplay();
    }
  }, WATCHDOG_INTERVAL_MS);
}

// ---------------------------------------------------------------------------
// Periodic Reload (every 12h – prevents memory leaks in 24/7 operation)
// ---------------------------------------------------------------------------

function startPeriodicReload() {
  if (periodicReloadTimer) clearInterval(periodicReloadTimer);

  periodicReloadTimer = setInterval(() => {
    if (isOffline) return; // Don't reload if already offline
    console.log('[Kiosk] Periodischer Reload (alle 12h) – lade Display neu');
    loadDisplay();
  }, PERIODIC_RELOAD_MS);
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

// Nur eine Instanz erlauben
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  console.log('[Kiosk] Andere Instanz läuft bereits – beende.');
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  // Prevent display from going to sleep
  powerSaveId = powerSaveBlocker.start('prevent-display-sleep');
  console.log(`[Kiosk] PowerSaveBlocker aktiv (ID: ${powerSaveId})`);

  // Benachrichtigungen unterdrücken
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'notifications') {
      callback(false);
    } else {
      callback(true);
    }
  });

  createWindow();

  // Globale Shortcuts im Kiosk-Modus blockieren
  if (config.kioskMode) {
    try {
      globalShortcut.register('Alt+F4', () => {});
      globalShortcut.register('Alt+Tab', () => {});
      globalShortcut.register('Super', () => {});
    } catch {
      // Einige Shortcuts können nicht auf allen Plattformen registriert werden
    }
  }
});

// ---- GPU Process Crash Recovery ----
app.on('gpu-process-crashed', (_event, killed) => {
  console.error(`[Kiosk] GPU-Prozess ${killed ? 'killed' : 'crashed'} – lade Display neu in 3s`);
  scheduleReload(3000);
});

app.on('child-process-gone', (_event, details) => {
  if (details.type === 'GPU') {
    console.error(`[Kiosk] GPU child process gone (reason: ${details.reason}) – lade Display neu in 3s`);
    scheduleReload(3000);
  }
});

app.on('window-all-closed', () => {
  if (watchdogInterval) clearInterval(watchdogInterval);
  if (periodicReloadTimer) clearInterval(periodicReloadTimer);
  if (retryTimer) clearTimeout(retryTimer);
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (watchdogInterval) clearInterval(watchdogInterval);
  if (periodicReloadTimer) clearInterval(periodicReloadTimer);
  if (retryTimer) clearTimeout(retryTimer);
  if (powerSaveId !== null && powerSaveBlocker.isStarted(powerSaveId)) {
    powerSaveBlocker.stop(powerSaveId);
  }
});

// Unhandled Errors abfangen – nicht abstürzen
process.on('uncaughtException', (err) => {
  console.error('[Kiosk] Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Kiosk] Unhandled Rejection:', reason);
});
