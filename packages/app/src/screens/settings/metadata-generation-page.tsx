import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native-unistyles";
import type { AgentProvider } from "@getpaseo/protocol/agent-types";
import { CombinedModelSelector } from "@/components/combined-model-selector";
import { ExternalLink } from "@/components/ui/external-link";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useDaemonConfig } from "@/hooks/use-daemon-config";
import { useProvidersSnapshot } from "@/hooks/use-providers-snapshot";
import { useHosts } from "@/runtime/host-runtime";
import { useLocalDaemonServerId } from "@/hooks/use-is-local-daemon";
import { buildSelectableProviderSelectorProviders } from "@/provider-selection/provider-selection";
import { SettingsSection } from "@/components/settings/headings/settings-section";
import { settingsStyles } from "@/styles/settings";

const METADATA_GENERATION_DOCS_URL = "https://github.com/NamanGaonkar/whis-desktop";
type SelectionMode = "automatic" | "preferred";

function resolveEffectiveServerId(
  serverId: string,
  localServerId: string | null,
  hosts: readonly { serverId: string }[],
): string {
  if (!serverId || serverId === "local") {
    return localServerId ?? hosts[0]?.serverId ?? serverId;
  }
  return serverId;
}

interface PreferredModelRowProps {
  providers: ReturnType<typeof buildSelectableProviderSelectorProviders>;
  configuredProvider: { provider: string; model?: string } | null;
  onSelect: (provider: AgentProvider, model: string) => void;
  isLoading: boolean;
  onOpen: () => void;
  onRetryProvider: (provider: AgentProvider) => void;
  isRetryingProvider: boolean;
  disabled: boolean;
  serverId: string;
  t: (key: string) => string;
}

function PreferredModelRow({
  providers,
  configuredProvider,
  onSelect,
  isLoading,
  onOpen,
  onRetryProvider,
  isRetryingProvider,
  disabled,
  serverId,
  t,
}: PreferredModelRowProps) {
  return (
    <View style={[settingsStyles.row, settingsStyles.rowBorder]}>
      <View style={settingsStyles.rowContent}>
        <Text style={settingsStyles.rowTitle}>{t("settings.metadataGeneration.model")}</Text>
        <Text style={settingsStyles.rowHint}>{t("settings.metadataGeneration.modelHint")}</Text>
      </View>
      <CombinedModelSelector
        providers={providers}
        selectedProvider={configuredProvider?.provider ?? ""}
        selectedModel={configuredProvider?.model ?? ""}
        onSelect={onSelect}
        isLoading={isLoading}
        onOpen={onOpen}
        onRetryProvider={onRetryProvider}
        isRetryingProvider={isRetryingProvider}
        disabled={disabled}
        serverId={serverId}
        desktopPlacement="bottom-start"
        desktopMinWidth={360}
      />
    </View>
  );
}

export function MetadataGenerationPage({ serverId }: { serverId: string }) {
  const { t } = useTranslation();
  const hosts = useHosts();
  const localServerId = useLocalDaemonServerId();
  const effectiveServerId = resolveEffectiveServerId(serverId, localServerId, hosts);
  const { config, isLoading: isConfigLoading, patchConfig } = useDaemonConfig(effectiveServerId);
  const snapshot = useProvidersSnapshot(effectiveServerId);
  const providers = useMemo(
    () => buildSelectableProviderSelectorProviders(snapshot.entries),
    [snapshot.entries],
  );

  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  const configuredProviders = useMemo(
    () => config?.metadataGeneration?.providers ?? [],
    [config?.metadataGeneration?.providers],
  );
  const configuredProvider = configuredProviders[0] ?? null;
  const savedMode: SelectionMode = configuredProvider ? "preferred" : "automatic";
  const [draftMode, setDraftMode] = useState<SelectionMode | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const mode = draftMode ?? savedMode;

  useEffect(() => {
    setDraftMode(null);
  }, [configuredProvider?.model, configuredProvider?.provider]);

  const modeOptions = useMemo(
    () => [
      { value: "automatic" as const, label: t("settings.metadataGeneration.automatic") },
      { value: "preferred" as const, label: t("settings.metadataGeneration.preferred") },
    ],
    [t],
  );

  const saveProviders = useCallback(
    async (providersPatch: { provider: string; model?: string }[]) => {
      setIsSaving(true);
      try {
        await patchConfig({ metadataGeneration: { providers: providersPatch } });
      } catch (error) {
        setDraftMode(null);
        Alert.alert(
          t("settings.metadataGeneration.saveError"),
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setIsSaving(false);
      }
    },
    [patchConfig, t],
  );

  const handleModeChange = useCallback(
    (next: SelectionMode) => {
      setDraftMode(next);
      if (next === "automatic") {
        void saveProviders([]);
      }
    },
    [saveProviders],
  );

  const handleModelSelect = useCallback(
    (provider: AgentProvider, model: string) => {
      setDraftMode("preferred");
      void saveProviders([
        { provider, ...(model ? { model } : {}) },
        ...(configuredProviders.slice(1) ?? []),
      ]);
    },
    [configuredProviders, saveProviders],
  );

  const handleSelectorOpen = useCallback(() => {
    snapshot.refetchIfStale(configuredProvider?.provider);
  }, [configuredProvider?.provider, snapshot]);
  const handleRetryProvider = useCallback(
    (provider: AgentProvider) => snapshot.refresh([provider]),
    [snapshot],
  );
  const docsLink = useMemo(
    () => (
      <ExternalLink
        href={METADATA_GENERATION_DOCS_URL}
        label={t("settings.metadataGeneration.docs")}
      />
    ),
    [t],
  );

  if (isConfigLoading && !config && !timedOut) {
    return (
      <View style={styles.loading}>
        <LoadingSpinner size="large" color={styles.spinnerColor.color} />
      </View>
    );
  }

  return (
    <SettingsSection
      title={t("settings.metadataGeneration.title")}
      info={t("settings.metadataGeneration.description")}
      trailing={docsLink}
      testID="metadata-generation-settings"
    >
      <View style={settingsStyles.card}>
        <View style={settingsStyles.row}>
          <View style={settingsStyles.rowContent}>
            <Text style={settingsStyles.rowTitle}>
              {t("settings.metadataGeneration.selection")}
            </Text>
            <Text style={settingsStyles.rowHint}>
              {mode === "automatic"
                ? t("settings.metadataGeneration.automaticHint")
                : t("settings.metadataGeneration.preferredHint")}
            </Text>
          </View>
          <SegmentedControl
            options={modeOptions}
            value={mode}
            onValueChange={handleModeChange}
            size="sm"
            testID="metadata-generation-mode"
          />
        </View>
        {mode === "preferred" ? (
          <PreferredModelRow
            providers={providers}
            configuredProvider={configuredProvider}
            onSelect={handleModelSelect}
            isLoading={snapshot.isLoading || snapshot.isFetching}
            onOpen={handleSelectorOpen}
            onRetryProvider={handleRetryProvider}
            isRetryingProvider={snapshot.isRefreshing}
            disabled={isSaving}
            serverId={serverId}
            t={t}
          />
        ) : null}
      </View>
    </SettingsSection>
  );
}

const styles = StyleSheet.create((theme) => ({
  loading: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
  },
  spinnerColor: {
    color: theme.colors.foregroundMuted,
  },
}));
