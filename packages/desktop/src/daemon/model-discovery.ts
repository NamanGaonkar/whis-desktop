export interface DiscoveredModel {
  id: string;
  label: string;
  description?: string;
}

export interface DetectModelsInput {
  provider: string;
  apiKey?: string;
  endpoint?: string;
}

export async function fetchProviderModels(input: DetectModelsInput): Promise<{
  ok: boolean;
  models: DiscoveredModel[];
  error?: string;
}> {
  const provider = input.provider.toLowerCase().trim();
  const apiKey = (input.apiKey || "").trim();
  const endpoint = (input.endpoint || "").trim();

  try {
    // 1. Ollama (local tags)
    if (provider === "ollama") {
      const baseUrl = (endpoint || "http://127.0.0.1:11434").replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/api/tags`, { method: "GET" });
      if (!res.ok) {
        return {
          ok: false,
          models: [],
          error: `Ollama returned HTTP ${res.status}: ${res.statusText}`,
        };
      }
      const data = (await res.json()) as {
        models?: Array<{ name: string; details?: { parameter_size?: string; family?: string } }>;
      };
      const models = (data.models || []).map((m) => ({
        id: m.name,
        label: m.name,
        description: m.details?.parameter_size
          ? `${m.details.parameter_size} (${m.details.family ?? "local"})`
          : undefined,
      }));
      return { ok: true, models };
    }

    if (!apiKey) {
      return {
        ok: false,
        models: [],
        error: "An API key is required to detect authorized models for this provider.",
      };
    }

    // 2. Anthropic Claude
    if (provider === "claude" || provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/models", {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      });
      if (!res.ok) {
        const errText = await res.text();
        return {
          ok: false,
          models: [],
          error: `Anthropic API returned HTTP ${res.status}: ${errText.slice(0, 150)}`,
        };
      }
      const data = (await res.json()) as {
        data?: Array<{ id: string; display_name?: string; created_at?: string }>;
      };
      const models = (data.data || []).map((m) => ({
        id: m.id,
        label: m.display_name || m.id,
      }));
      return { ok: true, models };
    }

    // 3. Google Gemini
    if (provider === "gemini" || provider === "google") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) {
        const errText = await res.text();
        return {
          ok: false,
          models: [],
          error: `Google Gemini API returned HTTP ${res.status}: ${errText.slice(0, 150)}`,
        };
      }
      const data = (await res.json()) as {
        models?: Array<{
          name: string;
          displayName?: string;
          supportedGenerationMethods?: string[];
        }>;
      };
      const models = (data.models || [])
        .filter(
          (m) =>
            !m.supportedGenerationMethods ||
            m.supportedGenerationMethods.includes("generateContent"),
        )
        .map((m) => {
          const cleanId = m.name.replace(/^models\//, "");
          return {
            id: cleanId,
            label: m.displayName || cleanId,
          };
        });
      return { ok: true, models };
    }

    // 4. OpenAI & OpenAI-compatible providers (DeepSeek, Grok, OpenRouter, MiniMax, Kimi, Z.ai, etc.)
    let candidateUrls: string[] = [];
    if (endpoint) {
      const cleanEp = endpoint.replace(/\/+$/, "");
      if (cleanEp.endsWith("/models")) {
        candidateUrls.push(cleanEp);
      } else if (cleanEp.endsWith("/v1")) {
        candidateUrls.push(`${cleanEp}/models`);
      } else {
        candidateUrls.push(`${cleanEp}/models`, `${cleanEp}/v1/models`);
      }
    } else {
      switch (provider) {
        case "deepseek":
          candidateUrls = ["https://api.deepseek.com/models", "https://api.deepseek.com/v1/models"];
          break;
        case "grok":
        case "xai":
          candidateUrls = ["https://api.x.ai/v1/models"];
          break;
        case "openrouter":
          candidateUrls = ["https://openrouter.ai/api/v1/models"];
          break;
        case "minimax":
          candidateUrls = ["https://api.minimax.chat/v1/models"];
          break;
        case "kimi":
        case "moonshot":
          candidateUrls = ["https://api.moonshot.cn/v1/models"];
          break;
        case "zai":
        case "glm":
          candidateUrls = ["https://open.bigmodel.cn/api/paas/v4/models"];
          break;
        case "openai":
        default:
          candidateUrls = ["https://api.openai.com/v1/models"];
          break;
      }
    }

    let lastError = "";
    for (const testUrl of candidateUrls) {
      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${apiKey}`,
        };
        if (provider === "openrouter") {
          headers["HTTP-Referer"] = "https://whis.app";
          headers["X-Title"] = "Whis Desktop";
        }

        const res = await fetch(testUrl, { method: "GET", headers });
        if (res.ok) {
          const data = (await res.json()) as {
            data?: Array<{ id?: string; name?: string }>;
            models?: Array<{ id?: string; name?: string }>;
          };
          const rawList = Array.isArray(data.data)
            ? data.data
            : Array.isArray(data.models)
              ? data.models
              : [];

          const models: DiscoveredModel[] = rawList
            .map((item) => {
              const id = item.id || item.name || "";
              const label = item.name || item.id || id;
              return { id, label };
            })
            .filter((m) => m.id.length > 0);

          if (models.length > 0) {
            return { ok: true, models };
          }
        } else {
          const text = await res.text();
          lastError = `HTTP ${res.status}: ${text.slice(0, 150)}`;
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }

    return {
      ok: false,
      models: [],
      error: lastError || `Could not detect models from ${candidateUrls.join(" or ")}`,
    };
  } catch (error) {
    return {
      ok: false,
      models: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
