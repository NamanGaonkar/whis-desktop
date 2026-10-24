export type ProviderType =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'groq'
  | 'deepseek'
  | 'ollama'
  | 'openrouter'
  | 'custom';

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl?: string;
  apiKey?: string;
  selectedModel: string;
  availableModels: string[];
  isActive: boolean;
}

export type AppTheme = 'light' | 'dark' | 'system';

export interface PtySpawnOptions {
  id: string;
  command?: string;
  args?: string[];
  cwd?: string;
  cols?: number;
  rows?: number;
}

export interface PtyExitInfo {
  exitCode?: number;
  signal?: number;
}

export interface SessionRecord {
  id: string;
  title: string;
  cwd: string;
  createdAt: number;
  providerId?: string;
  model?: string;
}

export interface WhisAPI {
  // PTY Controls
  spawnPty: (options: PtySpawnOptions) => Promise<{ success: boolean; pid?: number; error?: string }>;
  writePty: (id: string, data: string) => void;
  resizePty: (id: string, cols: number, rows: number) => void;
  killPty: (id: string) => void;
  onPtyData: (id: string, cb: (data: string) => void) => () => void;
  onPtyExit: (id: string, cb: (info: PtyExitInfo) => void) => () => void;

  // Window Controls
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;

  // Provider Management
  getProviders: () => Promise<ProviderConfig[]>;
  saveProviders: (providers: ProviderConfig[]) => Promise<void>;
  setActiveProvider: (id: string) => Promise<void>;
  testProviderConnection: (provider: ProviderConfig) => Promise<{ ok: boolean; message: string }>;

  // Directory and Environment
  selectDirectory: (defaultPath?: string) => Promise<string | null>;
  getDefaultCwd: () => Promise<string>;
  getAppVersion: () => Promise<string>;
  openExternal: (url: string) => Promise<void>;

  // Theme & Settings
  getTheme: () => Promise<AppTheme>;
  setTheme: (theme: AppTheme) => Promise<void>;

  // History / Sessions
  getSessions: () => Promise<SessionRecord[]>;
  saveSession: (session: SessionRecord) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
}
