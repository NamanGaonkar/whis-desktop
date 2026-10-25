export interface ByokProviderItem {
  id: string;
  name: string;
  brand: string;
  description: string;
  defaultEndpoint: string;
  envKey: string;
  keyUrl: string;
  isLocal?: boolean;
  autoDetectUrl?: string;
  popularModels: Array<{ id: string; label: string; description?: string }>;
}

export const BYOK_PROVIDERS: readonly ByokProviderItem[] = [
  {
    id: "claude",
    name: "Anthropic Claude",
    brand: "Anthropic",
    description:
      "Frontier reasoning & coding models with strong tool use and artifact capabilities.",
    defaultEndpoint: "https://api.anthropic.com/v1",
    envKey: "ANTHROPIC_API_KEY",
    keyUrl: "https://console.anthropic.com/settings/keys",
    popularModels: [
      { id: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet (Hybrid Reasoning)" },
      { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (Latest)" },
      { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (Fast & Lightweight)" },
      { id: "claude-3-opus-20240229", label: "Claude 3 Opus" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI (ChatGPT)",
    brand: "OpenAI",
    description: "Flagship intelligence and reasoning models for complex programming.",
    defaultEndpoint: "https://api.openai.com/v1",
    envKey: "OPENAI_API_KEY",
    keyUrl: "https://platform.openai.com/api-keys",
    popularModels: [
      { id: "gpt-4o", label: "GPT-4o (Omni Frontier)" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini (Fast & Cheap)" },
      { id: "o1", label: "OpenAI o1 (Full Reasoning)" },
      { id: "o1-mini", label: "OpenAI o1 Mini (Fast Reasoning)" },
      { id: "o3-mini", label: "OpenAI o3 Mini (STEM & Coding)" },
      { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    brand: "DeepSeek",
    description: "Open-weights state-of-the-art coding and mathematical reasoning models.",
    defaultEndpoint: "https://api.deepseek.com/v1",
    envKey: "DEEPSEEK_API_KEY",
    keyUrl: "https://platform.deepseek.com/api_keys",
    popularModels: [
      { id: "deepseek-chat", label: "DeepSeek-V3 (Chat & Coder)" },
      { id: "deepseek-reasoner", label: "DeepSeek-R1 (Chain-of-Thought Reasoning)" },
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    brand: "Google",
    description: "Next-generation multimodal models with up to 2M tokens context window.",
    defaultEndpoint: "https://generativelanguage.googleapis.com/v1beta",
    envKey: "GEMINI_API_KEY",
    keyUrl: "https://aistudio.google.com/app/apikey",
    popularModels: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Next Gen Fast)" },
      { id: "gemini-2.0-flash-thinking-exp", label: "Gemini 2.0 Flash Thinking Exp" },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro (2M Context)" },
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    ],
  },
  {
    id: "grok",
    name: "xAI Grok",
    brand: "xAI",
    description: "Frontier reasoning and real-time knowledge models by xAI.",
    defaultEndpoint: "https://api.x.ai/v1",
    envKey: "GROK_API_KEY",
    keyUrl: "https://console.x.ai/",
    popularModels: [
      { id: "grok-2-1212", label: "Grok 2 (1212)" },
      { id: "grok-2-vision-1212", label: "Grok 2 Vision (1212)" },
      { id: "grok-beta", label: "Grok Beta" },
    ],
  },
  {
    id: "ollama",
    name: "Ollama (Local Models)",
    brand: "Ollama",
    description: "Run local open-source models completely offline on your computer.",
    defaultEndpoint: "http://127.0.0.1:11434",
    envKey: "OLLAMA_HOST",
    keyUrl: "https://ollama.com",
    isLocal: true,
    autoDetectUrl: "http://127.0.0.1:11434/api/tags",
    popularModels: [
      { id: "llama3.2:latest", label: "Llama 3.2 (Meta)" },
      { id: "deepseek-r1:latest", label: "DeepSeek R1 (Local Reasoner)" },
      { id: "qwen2.5-coder:latest", label: "Qwen 2.5 Coder (Alibaba)" },
      { id: "codellama:latest", label: "Code Llama (Meta)" },
      { id: "mistral:latest", label: "Mistral 7B (Mistral AI)" },
    ],
  },
  {
    id: "minimax",
    name: "MiniMax",
    brand: "MiniMax",
    description: "High-performance multimodal and coding LLM with ultra-large context.",
    defaultEndpoint: "https://api.minimax.chat/v1",
    envKey: "MINIMAX_API_KEY",
    keyUrl: "https://platform.minimaxi.com/",
    popularModels: [
      { id: "MiniMax-Text-01", label: "MiniMax-Text-01 (4M Tokens)" },
      { id: "abab6.5s-chat", label: "abab 6.5s Chat" },
    ],
  },
  {
    id: "moonshot",
    name: "Kimi (Moonshot AI)",
    brand: "Moonshot",
    description: "Pioneering ultra-long context window reasoning models from Moonshot AI.",
    defaultEndpoint: "https://api.moonshot.cn/v1",
    envKey: "MOONSHOT_API_KEY",
    keyUrl: "https://platform.moonshot.cn/console/api-keys",
    popularModels: [
      { id: "moonshot-v1-8k", label: "Moonshot v1 8K" },
      { id: "moonshot-v1-32k", label: "Moonshot v1 32K" },
      { id: "moonshot-v1-128k", label: "Moonshot v1 128K" },
      { id: "kimi-k1.5-preview", label: "Kimi k1.5 Preview" },
    ],
  },
  {
    id: "glm",
    name: "Z.ai (GLM / Zhipu AI)",
    brand: "Zhipu AI",
    description: "General Language Models from Zhipu AI with advanced reasoning & tool use.",
    defaultEndpoint: "https://open.bigmodel.cn/api/paas/v4",
    envKey: "ZHIPUAI_API_KEY",
    keyUrl: "https://bigmodel.cn/usercenter/apikeys",
    popularModels: [
      { id: "glm-4-plus", label: "GLM-4 Plus (Flagship)" },
      { id: "glm-4-0520", label: "GLM-4 0520" },
      { id: "glm-4-flash", label: "GLM-4 Flash (High Speed)" },
      { id: "glm-4-air", label: "GLM-4 Air" },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    brand: "OpenRouter",
    description: "Unified API gateway to 200+ models from OpenAI, Anthropic, Meta, and more.",
    defaultEndpoint: "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY",
    keyUrl: "https://openrouter.ai/keys",
    popularModels: [
      { id: "anthropic/claude-3.7-sonnet", label: "OpenRouter: Claude 3.7 Sonnet" },
      { id: "openai/gpt-4o", label: "OpenRouter: GPT-4o" },
      { id: "deepseek/deepseek-r1", label: "OpenRouter: DeepSeek R1" },
      { id: "meta-llama/llama-3.3-70b-instruct", label: "OpenRouter: Llama 3.3 70B" },
    ],
  },
];

export function findByokProvider(providerId: string): ByokProviderItem | undefined {
  const normalized = providerId.toLowerCase();
  return BYOK_PROVIDERS.find(
    (p) =>
      p.id === normalized ||
      normalized.includes(p.id) ||
      (p.brand && normalized.includes(p.brand.toLowerCase())),
  );
}
