import { useHosts, useHostRuntimeLastError } from "@/runtime/host-runtime";
import { useCallback, useEffect, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { View, Text, Pressable, ScrollView } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useRouter } from "expo-router";
import { FolderOpen, Inbox, Plug } from "lucide-react-native";
import { WhisLogo } from "@/components/icons/paseo-logo";
import { CommunityLinks } from "@/components/community-links";
import { MenuHeader } from "@/components/headers/menu-header";
import { useOpenAddProject } from "@/hooks/use-open-add-project";
import { useImportSession } from "@/hooks/use-import-session";
import { usePanelStore } from "@/stores/panel-store";
import {
  useIsCompactFormFactor,
  getIsElectronRuntime,
  HEADER_INNER_HEIGHT,
  HEADER_INNER_HEIGHT_MOBILE,
  HEADER_TOP_PADDING_MOBILE,
} from "@/constants/layout";
import { pickDirectory } from "@/desktop/pick-directory";
import { useOpenProject } from "@/hooks/use-open-project";
import { useLocalDaemonServerId } from "@/hooks/use-is-local-daemon";
import { buildNewWorkspaceRoute, buildSettingsHostSectionRoute } from "@/utils/host-routes";

const WINDOW_CONTENT_DATASET = { "window-content": "" };

export function OpenProjectScreen() {
  const { t } = useTranslation();
  const hosts = useHosts();
  const router = useRouter();
  const openDesktopAgentList = usePanelStore((s) => s.openDesktopAgentList);
  const openProjectPicker = useOpenAddProject();
  const localServerId = useLocalDaemonServerId();
  const effectiveServerId = localServerId ?? hosts[0]?.serverId;
  const openProject = useOpenProject(effectiveServerId ?? "local");
  const importSession = useImportSession({ serverId: effectiveServerId ?? undefined });

  const isCompactLayout = useIsCompactFormFactor();
  const isRowLayout = getIsElectronRuntime() || !isCompactLayout;

  useEffect(() => {
    if (!isCompactLayout) {
      openDesktopAgentList();
    }
  }, [isCompactLayout, openDesktopAgentList]);

  const handleOpenPicker = useCallback(async () => {
    if (getIsElectronRuntime()) {
      try {
        const path = await pickDirectory();
        if (path) {
          const result = await openProject(path);
          if (result.ok) {
            usePanelStore.getState().showMobileAgent();
            router.push(
              buildNewWorkspaceRoute({
                serverId: effectiveServerId ?? "local",
                projectId: result.project.projectId,
                sourceDirectory: result.project.projectRootPath,
                displayName: result.project.projectDisplayName,
              }),
            );
            return;
          }
          if (result.error) {
            console.error("Open project failed:", result.error);
          }
        }
        return;
      } catch (err) {
        console.error("Direct folder pick error", err);
        return;
      }
    }
    void openProjectPicker(effectiveServerId ?? undefined);
  }, [effectiveServerId, openProject, openProjectPicker, router]);

  const handleOpenProviders = useCallback(() => {
    const targetServerId = effectiveServerId ?? "local";
    router.push(buildSettingsHostSectionRoute(targetServerId, "providers"));
  }, [effectiveServerId, router]);

  return (
    <View style={styles.container}>
      <MenuHeader borderless />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        dataSet={WINDOW_CONTENT_DATASET}
      >
        <View style={styles.content}>
          <View style={styles.logo}>
            <WhisLogo size={52} />
          </View>
          {hosts.map((host) => (
            <HostError key={host.serverId} serverId={host.serverId} label={host.label} />
          ))}
          <View style={[styles.tiles, isRowLayout && styles.tilesRow]}>
            <HomeTile
              icon={FolderOpen}
              title={t("openProject.tiles.addProject.title")}
              description={t("openProject.tiles.addProject.description")}
              onPress={handleOpenPicker}
              testID="open-project-submit"
              accent
              isRow={isRowLayout}
            />
            <HomeTile
              icon={Inbox}
              title={t("openProject.tiles.importSession.title")}
              description={t("openProject.tiles.importSession.description")}
              onPress={importSession.open}
              testID="open-project-import-session"
              isRow={isRowLayout}
            />
            <HomeTile
              icon={Plug}
              title={t("openProject.tiles.setupProviders.title")}
              description={t("openProject.tiles.setupProviders.description")}
              onPress={handleOpenProviders}
              testID="open-project-setup-providers"
              isRow={isRowLayout}
            />
          </View>
        </View>
        <View style={styles.communityRow}>
          <CommunityLinks />
        </View>
      </ScrollView>
      {importSession.sheet}
    </View>
  );
}

function HostError({ serverId, label }: { serverId: string; label: string }) {
  const error = useHostRuntimeLastError(serverId);
  return error ? (
    <Text accessibilityRole="alert" style={styles.hostError}>
      {label}: {error}
    </Text>
  ) : null;
}

interface HomeTileProps {
  icon: ComponentType<{ size: number; color: string }>;
  title: string;
  description: string;
  onPress: () => void;
  testID?: string;
  accent?: boolean;
  isRow?: boolean;
}

function HomeTile({
  icon: Icon,
  title,
  description,
  onPress,
  testID,
  accent,
  isRow,
}: HomeTileProps) {
  // useUnistyles is acceptable here: leaf component, off the hot path (home screen renders once).
  const { theme } = useUnistyles();
  const [hovered, setHovered] = useState(false);
  const handleHoverIn = useCallback(() => setHovered(true), []);
  const handleHoverOut = useCallback(() => setHovered(false), []);

  const iconColor = accent ? theme.colors.accent : theme.colors.foregroundMuted;

  const pressableStyle = useCallback(
    ({ pressed }: { pressed: boolean }) => [
      styles.tile,
      isRow && styles.tileRow,
      hovered && styles.tileHovered,
      pressed && styles.tilePressed,
    ],
    [hovered, isRow],
  );

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      testID={testID}
      style={pressableStyle}
    >
      <Icon size={20} color={iconColor} />
      <View style={styles.tileText}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileDescription}>{description}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface0,
    userSelect: "none",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    position: "relative",
    flexGrow: 1,
    flexShrink: 0,
    justifyContent: { xs: "flex-start", md: "center" },
    alignItems: "center",
    gap: 0,
    padding: theme.spacing[6],
    paddingTop: { xs: theme.spacing[12], md: theme.spacing[6] },
  },
  logo: {
    marginBottom: theme.spacing[8],
  },
  hostError: {
    color: theme.colors.destructive,
    fontSize: theme.fontSize.base,
    maxWidth: 452,
    textAlign: "center",
  },
  tiles: {
    marginTop: { xs: theme.spacing[6], md: theme.spacing[12] },
    width: "100%",
    maxWidth: { xs: 452, md: 780 },
    flexDirection: "row",
    flexWrap: { xs: "wrap", md: "nowrap" },
    justifyContent: "center",
    gap: theme.spacing[3],
  },
  tilesRow: {
    flexDirection: "row" as const,
    flexWrap: "nowrap" as const,
    maxWidth: 840,
    width: "100%",
  },
  tile: {
    width: { xs: "100%", md: 230 },
    flex: { xs: undefined, md: 1 },
    minHeight: { xs: 0, md: 120 },
    padding: theme.spacing[4],
    backgroundColor: theme.colors.surface1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    gap: theme.spacing[3],
  },
  tileRow: {
    flex: 1,
    width: "auto" as const,
    minWidth: 180,
  },
  tileHovered: {
    backgroundColor: theme.colors.surface2,
    borderColor: theme.colors.borderAccent,
  },
  tilePressed: {
    opacity: 0.85,
  },
  tileText: {
    gap: theme.spacing[1],
  },
  tileTitle: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.normal,
  },
  tileDescription: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.base,
    lineHeight: 18,
  },
  communityRow: {
    flexShrink: 0,
    paddingBottom: {
      xs: HEADER_INNER_HEIGHT_MOBILE + HEADER_TOP_PADDING_MOBILE + theme.spacing[2],
      md: HEADER_INNER_HEIGHT + theme.spacing[2],
    },
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 0,
  },
}));
