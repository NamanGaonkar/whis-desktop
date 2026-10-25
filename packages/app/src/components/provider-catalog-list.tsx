import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View, type LayoutChangeEvent } from "react-native";
import { SvgXml } from "react-native-svg";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import { KeyRound, PackagePlus, Sparkles } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "@/components/ui/external-link";
import { SearchField } from "@/components/ui/search-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { rankProviderCatalog } from "@/components/provider-catalog-search";
import {
  useAcpProviderCatalog,
  type AcpProviderCatalogItem,
} from "@/hooks/use-acp-provider-catalog";
import { useProvidersSnapshot } from "@/hooks/use-providers-snapshot";
import { useDaemonConfig } from "@/hooks/use-daemon-config";
import { useProviderSettingsStore } from "@/stores/provider-settings-store";
import { BYOK_PROVIDERS, type ByokProviderItem } from "@/data/byok-providers";
import { SPACING, type Theme } from "@/styles/theme";
import { settingsStyles } from "@/styles/settings";

interface ProviderCatalogListProps {
  serverId: string;
  installingProviderId: string | null;
  onInstall: (entry: AcpProviderCatalogItem) => Promise<void> | void;
}

const PROVIDER_FALLBACK_ICON_SIZE = 20;
const PROVIDER_REMOTE_ICON_SIZE = 24;
const TILE_GAP = SPACING[3];
/** Narrowest tile that keeps the icon, type badge, install link, and Add on one row. */
const MIN_TILE_WIDTH = 300;
const MAX_COLUMNS = 4;

const ThemedPackagePlus = withUnistyles(PackagePlus);
const ThemedSvgXml = withUnistyles(SvgXml);

const foregroundColorMapping = (theme: Theme) => ({ color: theme.colors.foreground });

function columnCountForWidth(width: number): number {
  const fits = Math.floor((width + TILE_GAP) / (MIN_TILE_WIDTH + TILE_GAP));
  return Math.min(MAX_COLUMNS, Math.max(1, fits));
}

interface ByokCatalogTileProps {
  item: ByokProviderItem;
  width: number | undefined;
  configured: boolean;
  onConfigure: (item: ByokProviderItem) => void;
}

function ByokCatalogTile({ item, width, configured, onConfigure }: ByokCatalogTileProps) {
  const { t } = useTranslation();
  const tileStyle = useMemo(
    () => [settingsStyles.card, styles.tile, width === undefined ? styles.tileFull : { width }],
    [width],
  );

  return (
    <View style={tileStyle} testID={`byok-catalog-tile-${item.id}`}>
      <View style={styles.iconFrame}>
        {item.isLocal ? (
          <Sparkles size={PROVIDER_FALLBACK_ICON_SIZE} color={styles.accentIcon.color} />
        ) : (
          <KeyRound size={PROVIDER_FALLBACK_ICON_SIZE} color={styles.accentIcon.color} />
        )}
      </View>
      <View style={styles.details}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.byokDescription} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.metaRow}>
          <StatusBadge
            label={item.isLocal ? "Local Offline" : "BYOK / API Key"}
            size="xs"
            variant={configured ? "success" : "muted"}
          />
          {configured ? <StatusBadge label="Active" size="xs" variant="success" /> : null}
        </View>
      </View>
      <Button
        size="xs"
        variant={configured ? "outline" : "default"}
        onPress={() => onConfigure(item)}
        style={styles.addButton}
        testID={`configure-byok-${item.id}`}
      >
        {configured
          ? t("providerCatalog.actions.configured", "Configure")
          : t("providerCatalog.actions.setup", "Add / Setup")}
      </Button>
    </View>
  );
}

interface CatalogTileProps {
  entry: AcpProviderCatalogItem;
  /** `undefined` until the grid is measured, or in a single column; the tile fills the row. */
  width: number | undefined;
  installing: boolean;
  onInstall: (entry: AcpProviderCatalogItem) => void;
}

function CatalogTile({ entry, width, installing, onInstall }: CatalogTileProps) {
  const { t } = useTranslation();
  const handleInstall = useCallback(() => {
    onInstall(entry);
  }, [entry, onInstall]);
  const tileStyle = useMemo(
    () => [settingsStyles.card, styles.tile, width === undefined ? styles.tileFull : { width }],
    [width],
  );

  return (
    <View style={tileStyle} testID={`provider-catalog-tile-${entry.id}`}>
      <View style={styles.iconFrame}>
        {entry.iconSvg ? (
          <ThemedSvgXml
            xml={entry.iconSvg}
            width={PROVIDER_REMOTE_ICON_SIZE}
            height={PROVIDER_REMOTE_ICON_SIZE}
            uniProps={foregroundColorMapping}
          />
        ) : (
          <ThemedPackagePlus size={PROVIDER_FALLBACK_ICON_SIZE} uniProps={foregroundColorMapping} />
        )}
      </View>
      <View style={styles.details}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.title}
        </Text>
        <View style={styles.metaRow}>
          {/* The catalog is the ACP registry, so every entry it offers is an ACP provider. */}
          <StatusBadge label={t("providerCatalog.types.acp")} size="xs" />
          <ExternalLink
            href={entry.installLink}
            label={t("providerCatalog.actions.installInstructions")}
            accessibilityLabel={t("providerCatalog.actions.installInstructionsFor", {
              provider: entry.title,
            })}
          />
        </View>
      </View>
      <Button
        size="xs"
        variant="outline"
        disabled={installing}
        loading={installing}
        onPress={handleInstall}
        accessibilityLabel={t("providerCatalog.actions.addProvider", { provider: entry.title })}
        style={styles.addButton}
        testID={`install-provider-${entry.id}`}
      >
        {installing ? t("providerCatalog.actions.adding") : t("providerCatalog.actions.add")}
      </Button>
    </View>
  );
}

export function ProviderCatalogList({
  serverId,
  installingProviderId,
  onInstall,
}: ProviderCatalogListProps) {
  const { t } = useTranslation();
  const { entries: catalogEntries } = useAcpProviderCatalog();
  const { entries: providerEntries } = useProvidersSnapshot(serverId);
  const openProviderSettings = useProviderSettingsStore((s) => s.open);
  const { patchConfig } = useDaemonConfig(serverId);
  const [search, setSearch] = useState("");
  const [gridWidth, setGridWidth] = useState<number | null>(null);

  const installedIds = useMemo(
    () => new Set(providerEntries?.map((entry) => entry.provider) ?? []),
    [providerEntries],
  );

  const filteredByok = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return BYOK_PROVIDERS;
    return BYOK_PROVIDERS.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.id.toLowerCase().includes(s) ||
        p.brand.toLowerCase().includes(s) ||
        p.description.toLowerCase().includes(s) ||
        p.popularModels.some(
          (m) => m.id.toLowerCase().includes(s) || m.label.toLowerCase().includes(s),
        ),
    );
  }, [search]);

  const availableEntries = useMemo(
    () =>
      rankProviderCatalog(
        catalogEntries.filter((entry) => !installedIds.has(entry.id)),
        search,
      ),
    [catalogEntries, installedIds, search],
  );

  const handleConfigureByok = useCallback(
    async (item: ByokProviderItem) => {
      try {
        await patchConfig({
          providers: {
            [item.id]: {
              enabled: true,
              ...(item.defaultEndpoint ? { options: { baseURL: item.defaultEndpoint } } : {}),
              additionalModels: item.popularModels.map((m) => ({ id: m.id, label: m.label })),
            },
          },
        });
      } catch (err) {
        console.warn("Auto initialize provider config error:", err);
      }
      openProviderSettings({ serverId, provider: item.id });
    },
    [openProviderSettings, patchConfig, serverId],
  );

  const handleGridLayout = useCallback((event: LayoutChangeEvent) => {
    setGridWidth(event.nativeEvent.layout.width);
  }, []);

  const tileWidth = useMemo(() => {
    if (gridWidth === null) return undefined;
    const columns = columnCountForWidth(gridWidth);
    if (columns === 1) return undefined;
    return Math.floor((gridWidth - TILE_GAP * (columns - 1)) / columns);
  }, [gridWidth]);

  return (
    <View>
      <View style={styles.searchRail}>
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder={t("providerCatalog.search", "Search providers and models...")}
          clearAccessibilityLabel={t("providerCatalog.clearSearch")}
          testID="provider-catalog-search"
          clearTestID="provider-catalog-search-clear"
        />
      </View>

      {/* BYOK & Local Ranked Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {t("settings.providers.byokTitle", "Supported Providers (Bring Your Own Key & Local)")}
        </Text>
      </View>
      <View style={styles.grid} onLayout={handleGridLayout}>
        {filteredByok.map((item) => {
          const isConfigured = installedIds.has(item.id);
          return (
            <ByokCatalogTile
              key={item.id}
              item={item}
              width={tileWidth}
              configured={isConfigured}
              onConfigure={handleConfigureByok}
            />
          );
        })}
      </View>

      {/* ACP Agents Section if matching */}
      {availableEntries.length > 0 ? (
        <>
          <View style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>
            <Text style={styles.sectionTitle}>
              {t("settings.providers.acpTitle", "Community & ACP Agent Plugins")}
            </Text>
          </View>
          <View style={styles.grid}>
            {availableEntries.map((entry) => (
              <CatalogTile
                key={entry.id}
                entry={entry}
                width={tileWidth}
                installing={installingProviderId === entry.id}
                onInstall={onInstall}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  searchRail: {
    flexDirection: "row",
    marginBottom: theme.spacing[3],
  },
  sectionHeader: {
    marginBottom: theme.spacing[2],
  },
  sectionHeaderSpaced: {
    marginTop: theme.spacing[4],
  },
  sectionTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.foregroundMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: TILE_GAP,
  },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[3],
    padding: theme.spacing[3],
  },
  tileFull: {
    width: "100%",
  },
  details: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing[1],
  },
  iconFrame: {
    flexShrink: 0,
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  accentIcon: {
    color: theme.colors.accent,
  },
  addButton: {
    flexShrink: 0,
  },
  name: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
  },
  byokDescription: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing[2],
    marginTop: 2,
  },
  stateBox: {
    minHeight: 96,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing[4],
  },
  stateText: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.base,
  },
}));
