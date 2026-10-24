import { contextBridge, ipcRenderer } from 'electron';
import {
  PtySpawnOptions,
  PtyExitInfo,
  ProviderConfig,
  AppTheme,
  SessionRecord,
  WhisAPI
} from '../shared/types';

const api: WhisAPI = {
  // PTY Controls
  spawnPty: (options: PtySpawnOptions) => ipcRenderer.invoke('pty:spawn', options),
  writePty: (id: string, data: string) => ipcRenderer.send('pty:write', { id, data }),
  resizePty: (id: string, cols: number, rows: number) =>
    ipcRenderer.send('pty:resize', { id, cols, rows }),
  killPty: (id: string) => ipcRenderer.send('pty:kill', { id }),

  onPtyData: (id: string, cb: (data: string) => void) => {
    const channel = `pty:data:${id}`;
    const listener = (_: any, data: string) => cb(data);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },

  onPtyExit: (id: string, cb: (info: PtyExitInfo) => void) => {
    const channel = `pty:exit:${id}`;
    const listener = (_: any, info: PtyExitInfo) => cb(info);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },

  // Window Controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),

  // Provider Management
  getProviders: () => ipcRenderer.invoke('providers:get'),
  saveProviders: (providers: ProviderConfig[]) => ipcRenderer.invoke('providers:save', providers),
  setActiveProvider: (id: string) => ipcRenderer.invoke('providers:setActive', id),
  testProviderConnection: (provider: ProviderConfig) =>
    ipcRenderer.invoke('providers:test', provider),

  // Directory and Environment
  selectDirectory: (defaultPath?: string) =>
    ipcRenderer.invoke('dialog:selectDirectory', defaultPath),
  getDefaultCwd: () => ipcRenderer.invoke('env:defaultCwd'),
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // Theme Settings
  getTheme: () => ipcRenderer.invoke('theme:get'),
  setTheme: (theme: AppTheme) => ipcRenderer.invoke('theme:set', theme),

  // History / Sessions
  getSessions: () => ipcRenderer.invoke('sessions:get'),
  saveSession: (session: SessionRecord) => ipcRenderer.invoke('sessions:save', session),
  deleteSession: (id: string) => ipcRenderer.invoke('sessions:delete', id)
};

contextBridge.exposeInMainWorld('whis', api);
