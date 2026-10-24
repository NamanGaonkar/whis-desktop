import { safeStorage } from 'electron';
import { getKV, setKV } from './db';
import { ProviderConfig } from '../shared/types';

export function getDefaultProviders(): ProviderConfig[] {
  return [
    {
      id: 'prov-anthropic',
      name: 'Anthropic Claude',
      type: 'anthropic',
      selectedModel: 'claude-3-7-sonnet-20250219',
      availableModels: [
        'claude-3-7-sonnet-20250219',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022'
      ],
      isActive: true
    },
    {
      id: 'prov-openai',
      name: 'OpenAI',
      type: 'openai',
      selectedModel: 'gpt-4o',
      availableModels: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'gpt-4.5-preview'],
      isActive: false
    },
    {
      id: 'prov-gemini',
      name: 'Google Gemini',
      type: 'gemini',
      selectedModel: 'gemini-2.0-flash',
      availableModels: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-thinking-exp'],
      isActive: false
    },
    {
      id: 'prov-deepseek',
      name: 'DeepSeek',
      type: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      selectedModel: 'deepseek-chat',
      availableModels: ['deepseek-chat', 'deepseek-reasoner'],
      isActive: false
    },
    {
      id: 'prov-groq',
      name: 'Groq Cloud',
      type: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      selectedModel: 'llama-3.3-70b-versatile',
      availableModels: ['llama-3.3-70b-versatile', 'deepseek-r1-distill-llama-70b'],
      isActive: false
    },
    {
      id: 'prov-ollama',
      name: 'Local Ollama',
      type: 'ollama',
      baseUrl: 'http://localhost:11434',
      selectedModel: 'llama3.3:70b',
      availableModels: ['llama3.3:70b', 'qwen2.5-coder:32b', 'deepseek-r1:14b', 'mistral:latest'],
      isActive: false
    },
    {
      id: 'prov-openrouter',
      name: 'OpenRouter',
      type: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      selectedModel: 'anthropic/claude-3.7-sonnet',
      availableModels: [
        'anthropic/claude-3.7-sonnet',
        'openai/gpt-4o',
        'deepseek/deepseek-r1',
        'google/gemini-2.0-flash-001'
      ],
      isActive: false
    }
  ];
}

export function getProviders(): ProviderConfig[] {
  const rawList = getKV<ProviderConfig[]>('providers');
  if (!rawList || !Array.isArray(rawList) || rawList.length === 0) {
    const defaults = getDefaultProviders();
    saveProviders(defaults);
    return defaults;
  }

  // Decrypt API keys if encrypted
  return rawList.map((p) => {
    let apiKey = p.apiKey;
    if (apiKey && apiKey.startsWith('enc:') && safeStorage.isEncryptionAvailable()) {
      try {
        const buff = Buffer.from(apiKey.slice(4), 'base64');
        apiKey = safeStorage.decryptString(buff);
      } catch {
        // Fallback keep existing
      }
    }
    return { ...p, apiKey };
  });
}

export function saveProviders(providers: ProviderConfig[]): void {
  // Encrypt sensitive API keys before saving
  const encrypted = providers.map((p) => {
    let apiKey = p.apiKey;
    if (apiKey && !apiKey.startsWith('enc:') && safeStorage.isEncryptionAvailable()) {
      try {
        const encryptedBuf = safeStorage.encryptString(apiKey);
        apiKey = `enc:${encryptedBuf.toString('base64')}`;
      } catch {
        // Fallback store as-is
      }
    }
    return { ...p, apiKey };
  });

  setKV('providers', encrypted);
}

export function getActiveProvider(): ProviderConfig | undefined {
  const list = getProviders();
  return list.find((p) => p.isActive) || list[0];
}

export function setActiveProvider(id: string): void {
  const list = getProviders();
  const updated = list.map((p) => ({
    ...p,
    isActive: p.id === id
  }));
  saveProviders(updated);
}

/** Injects active provider env vars when launching Whis CLI */
export function injectProviderEnv(env: Record<string, string>): void {
  const active = getActiveProvider();
  if (!active) return;

  switch (active.type) {
    case 'anthropic':
      if (active.apiKey) env.ANTHROPIC_API_KEY = active.apiKey;
      if (active.baseUrl) env.ANTHROPIC_BASE_URL = active.baseUrl;
      env.WHIS_PROVIDER = 'anthropic';
      break;
    case 'openai':
      if (active.apiKey) env.OPENAI_API_KEY = active.apiKey;
      if (active.baseUrl) env.OPENAI_BASE_URL = active.baseUrl;
      env.WHIS_PROVIDER = 'openai';
      break;
    case 'gemini':
      if (active.apiKey) env.GEMINI_API_KEY = active.apiKey;
      env.WHIS_PROVIDER = 'gemini';
      break;
    case 'deepseek':
      if (active.apiKey) env.DEEPSEEK_API_KEY = active.apiKey;
      if (active.baseUrl) env.DEEPSEEK_BASE_URL = active.baseUrl;
      env.WHIS_PROVIDER = 'deepseek';
      break;
    case 'groq':
      if (active.apiKey) env.GROQ_API_KEY = active.apiKey;
      if (active.baseUrl) env.GROQ_BASE_URL = active.baseUrl;
      env.WHIS_PROVIDER = 'groq';
      break;
    case 'openrouter':
      if (active.apiKey) env.OPENROUTER_API_KEY = active.apiKey;
      if (active.baseUrl) env.OPENROUTER_BASE_URL = active.baseUrl;
      env.WHIS_PROVIDER = 'openrouter';
      break;
    case 'ollama':
      env.OLLAMA_HOST = active.baseUrl || 'http://localhost:11434';
      env.WHIS_PROVIDER = 'ollama';
      break;
    case 'custom':
      if (active.apiKey) env.WHIS_API_KEY = active.apiKey;
      if (active.baseUrl) env.WHIS_BASE_URL = active.baseUrl;
      env.WHIS_PROVIDER = 'custom';
      break;
  }

  if (active.selectedModel) {
    env.WHIS_MODEL = active.selectedModel;
  }
}
