import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, TextInput, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Check, Eye, EyeOff, KeyRound, Link2, Plus, Sparkles } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { openExternalUrl } from "@/utils/open-external-url";
import { findByokProvider, type ByokProviderItem } from "@/data/byok-providers";
import type { MutableDaemonConfig, MutableDaemonConfigPatch } from "@getpaseo/protocol/messages";
import type { ProviderProfileModel } from "@getpaseo/protocol/provider-config";
import { settingsStyles } from "@/styles/settings";

interface ProviderByokConfigCardProps {
  provider: string;
  serverId: string;
  config: MutableDaemonConfig | null;
  patchConfig: (patch: MutableDaemonConfigPatch) => Promise<MutableDaemonConfig | undefined>;
  refresh: (providers?: string[]) => Promise<void>;
  additionalModels: ProviderProfileModel[];
}

export function ProviderByokConfigCard({
  provider,
  config,
  patchConfig,
  refresh,
  additionalModels,
}: ProviderByokConfigCardProps) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const byok = findByokProvider(provider);
  const envKey = byok?.envKey ?? `${provider.toUpperCase()}_API_KEY`;

  const providersMap = (config?.providers ?? {}) as Record<string, any>;
  const existingKey = (providersMap[provider]?.env?.[envKey] as string) ?? "";
  const existingEndpoint =
    (providersMap[provider]?.options?.baseURL as string) ?? byok?.defaultEndpoint ?? "";

  const [apiKey, setApiKey] = useState(existingKey);
  const [endpoint, setEndpoint] = useState(existingEndpoint);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detectingOllama, setDetectingOllama] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const pMap = (config?.providers ?? {}) as Record<string, any>;
    setApiKey((pMap[provider]?.env?.[envKey] as string) ?? "");
    setEndpoint((pMap[provider]?.options?.baseURL as string) ?? byok?.defaultEndpoint ?? "");
  }, [config, envKey, byok?.defaultEndpoint, provider]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setNotice(null);
    try {
      const popular = byok?.popularModels ?? [];
      const mergedAdditional =
        additionalModels.length > 0
          ? additionalModels
          : popular.map((m) => ({ id: m.id, label: m.label }));

      await patchConfig({
        providers: {
          [provider]: {
            enabled: true,
            ...(envKey ? { env: { [envKey]: apiKey.trim() } } : {}),
            ...(endpoint ? { options: { baseURL: endpoint.trim() } } : {}),
            additionalModels: mergedAdditional,
          },
        },
      });
      await refresh([provider]);
      setNotice(t("settings.providers.byok.saved", "API settings saved and provider enabled!"));
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : t("settings.providers.byok.failed", "Failed to save settings."),
      );
    } finally {
      setSaving(false);
    }
  }, [
    apiKey,
    byok?.popularModels,
    endpoint,
    envKey,
    additionalModels,
    patchConfig,
    provider,
    refresh,
    t,
  ]);

  const handleDetectOllama = useCallback(async () => {
    setDetectingOllama(true);
    setNotice(null);
    const targetUrl = (endpoint.trim() || "http://127.0.0.1:11434").replace(/\/+$/, "");
    try {
      const res = await fetch(`${targetUrl}/api/tags`);
      if (!res.ok) throw new Error(`Ollama returned HTTP ${res.status}`);
      const data = (await res.json()) as {
        models?: Array<{ name: string; details?: { parameter_size?: string; family?: string } }>;
      };
      const rawModels = data.models || [];
      if (rawModels.length === 0) {
        setNotice(
          "Ollama daemon is running, but no models found. Run 'ollama pull llama3.2' in terminal.",
        );
      } else {
        const detected = rawModels.map((m) => ({
          id: m.name,
          label: m.name,
          description: m.details?.parameter_size
            ? `${m.details.parameter_size} (${m.details.family ?? "model"})`
            : undefined,
        }));
        await patchConfig({
          providers: {
            [provider]: {
              enabled: true,
              options: { baseURL: targetUrl },
              additionalModels: detected,
            },
          },
        });
        await refresh([provider]);
        setNotice(`Found & connected ${detected.length} local Ollama model(s)!`);
      }
    } catch (err) {
      setNotice(
        `Could not reach Ollama at ${targetUrl}. Ensure Ollama is running ('ollama serve').`,
      );
    } finally {
      setDetectingOllama(false);
    }
  }, [endpoint, patchConfig, provider, refresh]);

  const handleQuickAddModel = useCallback(
    async (modelId: string, modelLabel: string) => {
      if (additionalModels.some((m) => m.id === modelId)) return;
      const nextModels = [...additionalModels, { id: modelId, label: modelLabel }];
      try {
        await patchConfig({
          providers: {
            [provider]: {
              enabled: true,
              additionalModels: nextModels,
            },
          },
        });
        await refresh([provider]);
      } catch (err) {
        console.error("Failed to add model", err);
      }
    },
    [additionalModels, patchConfig, provider, refresh],
  );

  const isConfigured = Boolean(
    (existingKey && existingKey.length > 5) ||
    (byok?.isLocal && (existingEndpoint || additionalModels.length > 0)),
  );

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <KeyRound size={18} color={theme.colors.accent} />
          <Text style={styles.title}>
            {byok?.name ?? provider} {t("settings.providers.byok.configuration", "Settings")}
          </Text>
        </View>
        {isConfigured ? (
          <View style={styles.configuredBadge}>
            <Check size={12} color={theme.colors.success} />
            <Text style={styles.configuredText}>
              {t("settings.providers.byok.configured", "Configured")}
            </Text>
          </View>
        ) : null}
      </View>

      {byok?.description ? <Text style={styles.description}>{byok.description}</Text> : null}

      {!byok?.isLocal ? (
        <View style={styles.fieldGroup}>
          <View style={styles.fieldLabelRow}>
            <Text style={styles.fieldLabel}>
              {t("settings.providers.byok.apiKeyLabel", "API Key")} ({envKey})
            </Text>
            {byok?.keyUrl ? (
              <Pressable
                onPress={() => void openExternalUrl(byok.keyUrl)}
                style={styles.keyUrlLink}
              >
                <Link2 size={12} color={theme.colors.accent} />
                <Text style={styles.keyUrlText}>
                  {t("settings.providers.byok.getKey", "Get API Key")}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              value={apiKey}
              onChangeText={setApiKey}
              placeholder={
                existingKey
                  ? "••••••••••••••••••••••••"
                  : `Paste your ${byok?.name ?? provider} API Key`
              }
              placeholderTextColor={theme.colors.foregroundMuted}
              secureTextEntry={!showKey}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.textInput}
            />
            <Pressable onPress={() => setShowKey(!showKey)} style={styles.eyeButton}>
              {showKey ? (
                <EyeOff size={16} color={theme.colors.foregroundMuted} />
              ) : (
                <Eye size={16} color={theme.colors.foregroundMuted} />
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>
          {t("settings.providers.byok.endpointLabel", "API Endpoint (Base URL)")}
        </Text>
        <TextInput
          value={endpoint}
          onChangeText={setEndpoint}
          placeholder={byok?.defaultEndpoint ?? "https://api..."}
          placeholderTextColor={theme.colors.foregroundMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.textInput}
        />
      </View>

      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

      <View style={styles.buttonRow}>
        {byok?.isLocal ? (
          <Button
            variant="default"
            size="sm"
            onPress={handleDetectOllama}
            disabled={detectingOllama || saving}
            leftIcon={detectingOllama ? undefined : Sparkles}
          >
            {detectingOllama
              ? t("settings.providers.byok.detecting", "Detecting Local Models...")
              : t("settings.providers.byok.detectOllama", "Detect Local Ollama (127.0.0.1:11434)")}
          </Button>
        ) : null}

        <Button
          variant={byok?.isLocal ? "outline" : "default"}
          size="sm"
          onPress={handleSave}
          disabled={saving || detectingOllama}
        >
          {saving
            ? t("settings.providers.byok.saving", "Saving...")
            : t("settings.providers.byok.save", "Save & Enable Provider")}
        </Button>
      </View>

      {byok?.popularModels && byok.popularModels.length > 0 ? (
        <View style={styles.quickAddGroup}>
          <Text style={styles.quickAddLabel}>
            {t("settings.providers.byok.popularModels", "Popular Models (Click to add):")}
          </Text>
          <View style={styles.chipsContainer}>
            {byok.popularModels.map((m) => {
              const alreadyAdded = additionalModels.some((item) => item.id === m.id);
              return (
                <Pressable
                  key={m.id}
                  disabled={alreadyAdded}
                  onPress={() => void handleQuickAddModel(m.id, m.label)}
                  style={[styles.chip, alreadyAdded && styles.chipActive]}
                >
                  {alreadyAdded ? (
                    <Check size={12} color={theme.colors.success} />
                  ) : (
                    <Plus size={12} color={theme.colors.foregroundMuted} />
                  )}
                  <Text style={[styles.chipText, alreadyAdded && styles.chipTextActive]}>
                    {m.id}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.surface1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing[4],
    gap: theme.spacing[3],
    marginBottom: theme.spacing[4],
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
  },
  title: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.foreground,
  },
  configuredBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface2,
  },
  configuredText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.success,
    fontWeight: theme.fontWeight.medium,
  },
  description: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
    lineHeight: 18,
  },
  fieldGroup: {
    gap: theme.spacing[1],
  },
  fieldLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fieldLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
    fontWeight: theme.fontWeight.medium,
  },
  keyUrlLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  keyUrlText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.accent,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface0,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
  },
  textInput: {
    flex: 1,
    height: 38,
    paddingHorizontal: theme.spacing[3],
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
    fontFamily: theme.fontFamily.ui,
    backgroundColor: theme.colors.surface0,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
  },
  eyeButton: {
    padding: theme.spacing[2],
  },
  noticeText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.accent,
  },
  buttonRow: {
    flexDirection: "row",
    gap: theme.spacing[2],
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: theme.spacing[1],
  },
  quickAddGroup: {
    gap: theme.spacing[2],
    marginTop: theme.spacing[2],
    paddingTop: theme.spacing[2],
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  quickAddLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing[2],
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: {
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.surface0,
  },
  chipText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
  },
  chipTextActive: {
    color: theme.colors.foreground,
  },
}));
