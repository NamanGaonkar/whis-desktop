import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { spawnAgentPty, writeAgentPty, resizeAgentPty, killAgentPty, killAllPtys } from './pty';
import { getProviders, saveProviders, setActiveProvider, getActiveProvider } from './providers';
import { getKV, setKV, getAllSessions, saveSessionRecord, deleteSessionRecord } from './db';
import { checkGitHubUpdate } from './updater';
import { PtySpawnOptions, ProviderConfig, AppTheme, SessionRecord } from '../shared/types';

let mainWindow: BrowserWindow | null = null;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow(): void {
  const icoPath = join(__dirname, '../../build/icon.ico');
  const pngPath = join(__dirname, '../../build/icon.png');
  const windowIcon = process.platform === 'win32'
    ? (existsSync(icoPath) ? icoPath : pngPath)
    : (existsSync(pngPath) ? pngPath : icoPath);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#12100E',
    icon: existsSync(windowIcon) ? windowIcon : undefined,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
    // Check for updates 3 seconds after startup
    setTimeout(() => {
      checkGitHubUpdate(mainWindow);
    }, 3000);
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // Load URL
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// App lifecycle
app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  killAllPtys();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  killAllPtys();
});

function setupIpcHandlers(): void {
  // PTY handlers
  ipcMain.handle('pty:spawn', (event, options: PtySpawnOptions) => {
    return spawnAgentPty(options, event.sender);
  });

  ipcMain.on('pty:write', (_, { id, data }: { id: string; data: string }) => {
    writeAgentPty(id, data);
  });

  ipcMain.on('pty:resize', (_, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
    resizeAgentPty(id, cols, rows);
  });

  ipcMain.on('pty:kill', (_, { id }: { id: string }) => {
    killAgentPty(id);
  });

  // Window control handlers
  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('window:maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on('window:close', () => {
    killAllPtys();
    mainWindow?.close();
  });

  // Providers handlers
  ipcMain.handle('providers:get', () => {
    return getProviders();
  });

  ipcMain.handle('providers:save', (_, providers: ProviderConfig[]) => {
    saveProviders(providers);
  });

  ipcMain.handle('providers:setActive', (_, id: string) => {
    setActiveProvider(id);
  });

  ipcMain.handle('providers:test', async (_, provider: ProviderConfig) => {
    try {
      if (provider.type === 'ollama') {
        const host = provider.baseUrl || 'http://localhost:11434';
        const res = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const json = (await res.json()) as any;
          const count = json.models?.length || 0;
          return { ok: true, message: `Connected to Ollama! Found ${count} model(s).` };
        }
        return { ok: false, message: `Ollama replied with HTTP status ${res.status}` };
      }

      if (!provider.apiKey) {
        return { ok: false, message: 'API key is missing.' };
      }

      return { ok: true, message: 'Configuration validated successfully.' };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Connection failed' };
    }
  });

  // Directory picker
  ipcMain.handle('dialog:selectDirectory', async (_, defaultPath?: string) => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Project Directory for Whis',
      defaultPath: defaultPath || process.cwd(),
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // Environment & system helpers
  ipcMain.handle('env:defaultCwd', () => {
    // Default to user home or current directory
    return process.env.USERPROFILE || process.env.HOME || process.cwd();
  });

  ipcMain.handle('app:version', () => {
    return app.getVersion();
  });

  ipcMain.handle('shell:openExternal', (_, url: string) => {
    shell.openExternal(url);
  });

  // Theme settings
  ipcMain.handle('theme:get', () => {
    return getKV<AppTheme>('theme', 'dark');
  });

  ipcMain.handle('theme:set', (_, theme: AppTheme) => {
    setKV('theme', theme);
  });

  // Sessions
  ipcMain.handle('sessions:get', () => {
    return getAllSessions();
  });

  ipcMain.handle('sessions:save', (_, session: SessionRecord) => {
    saveSessionRecord(session);
  });

  ipcMain.handle('sessions:delete', (_, id: string) => {
    deleteSessionRecord(id);
  });

  // Updater
  ipcMain.handle('updater:check', () => {
    return checkGitHubUpdate(mainWindow);
  });
}
