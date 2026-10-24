import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ExternalLink, Settings, ArrowRight } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { HostProfile } from "@/types/host-connection";
import { getHostRuntimeStore, isHostRuntimeConnected, useHosts } from "@/runtime/host-runtime";
import { Button } from "@/components/ui/button";
import { resolveAppVersion } from "@/utils/app-version";
import { formatVersionWithPrefix } from "@/desktop/updates/desktop-updates";
import { buildOpenProjectRoute } from "@/utils/host-routes";
import { WhisLogo } from "@/components/icons/paseo-logo";
import { openExternalUrl } from "@/utils/open-external-url";
import { isNative } from "@/constants/platform";

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.surface0,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: theme.spacing[6],
    paddingBottom: 0,
    alignItems: "center",
  },
  content: {
    width: "100%",
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    textAlign: "center",
  },
  subtitle: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.base,
    textAlign: "center",
  },
  copyBlock: {
    alignItems: "center",
    gap: theme.spacing[2],
    marginTop: theme.spacing[6],
    marginBottom: theme.spacing[8],
  },
  actions: {
    width: "100%",
    maxWidth: 320,
    gap: theme.spacing[3],
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing[3],
    paddingVertical: theme.spacing[4],
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.accent,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  actionText: {
    color: theme.colors.accentForeground,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
  },
  setupLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: theme.spacing[2],
  },
  setupLinkText: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
  },
  versionLabel: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
    textAlign: "center",
    marginTop: theme.spacing[6],
  },
  settingsButton: {
    alignSelf: "center",
    marginTop: theme.spacing[4],
  },
}));

function useAnyHostOnline(serverIds: string[]): string | null {
  const runtime = getHostRuntimeStore();
  return useSyncExternalStore(
    (onStoreChange) => runtime.subscribeAll(onStoreChange),
    () => {
      let firstOnlineServerId: string | null = null;
      let firstOnlineAt: string | null = null;
      for (const serverId of serverIds) {
        const snapshot = runtime.getSnapshot(serverId);
        const lastOnlineAt = snapshot?.lastOnlineAt ?? null;
        if (!isHostRuntimeConnected(snapshot) || !lastOnlineAt) {
          continue;
        }
        if (!firstOnlineAt || lastOnlineAt < firstOnlineAt) {
          firstOnlineAt = lastOnlineAt;
          firstOnlineServerId = serverId;
        }
      }
      return firstOnlineServerId;
    },
    () => {
      let firstOnlineServerId: string | null = null;
      let firstOnlineAt: string | null = null;
      for (const serverId of serverIds) {
        const snapshot = runtime.getSnapshot(serverId);
        const lastOnlineAt = snapshot?.lastOnlineAt ?? null;
        if (!isHostRuntimeConnected(snapshot) || !lastOnlineAt) {
          continue;
        }
        if (!firstOnlineAt || lastOnlineAt < firstOnlineAt) {
          firstOnlineAt = lastOnlineAt;
          firstOnlineServerId = serverId;
        }
      }
      return firstOnlineServerId;
    },
  );
}

export interface WelcomeScreenProps {
  onHostAdded?: (profile: HostProfile) => void;
}

export function WelcomeScreen({ onHostAdded: _onHostAdded }: WelcomeScreenProps) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const appVersion = resolveAppVersion();
  const appVersionText = formatVersionWithPrefix(appVersion);
  const hosts = useHosts();
  const anyOnlineServerId = useAnyHostOnline(hosts.map((h) => h.serverId));

  useEffect(() => {
    if (!anyOnlineServerId) return;
    router.replace(buildOpenProjectRoute());
  }, [anyOnlineServerId, router]);

  const finishOnboarding = useCallback(() => {
    router.replace(buildOpenProjectRoute());
  }, [router]);

  const handleOpenGitHub = useCallback(() => {
    void openExternalUrl("https://github.com/NamanGaonkar/whis-desktop");
  }, []);

  const handleOpenSettings = useCallback(() => {
    router.push("/settings");
  }, [router]);

  const scrollContentContainerStyle = useMemo(
    () => [styles.container, { paddingBottom: theme.spacing[6] + insets.bottom }],
    [theme.spacing, insets.bottom],
  );

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={scrollContentContainerStyle}
        showsVerticalScrollIndicator={false}
        testID="welcome-screen"
      >
        <View style={styles.content}>
          <WhisLogo size={96} />
          <View style={styles.copyBlock}>
            <Text style={styles.title}>{t("onboarding.title")}</Text>
            <Text style={styles.subtitle}>{t("onboarding.subtitle")}</Text>
            {isNative ? (
              <Pressable style={styles.setupLink} onPress={handleOpenGitHub}>
                <Text style={styles.setupLinkText}>github.com/NamanGaonkar/whis-desktop</Text>
                <ExternalLink size={14} color={theme.colors.accent} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.actions}>
            <Pressable
              style={styles.actionButton}
              onPress={finishOnboarding}
              testID="welcome-get-started"
            >
              <Text style={styles.actionText}>Get Started</Text>
              <ArrowRight size={18} color={theme.colors.accentForeground} />
            </Pressable>
          </View>

          <Button
            variant="ghost"
            size="sm"
            leftIcon={Settings}
            onPress={handleOpenSettings}
            style={styles.settingsButton}
            testID="welcome-open-settings"
          >
            {t("onboarding.actions.settings")}
          </Button>
        </View>
        <Text style={styles.versionLabel}>{appVersionText}</Text>
      </ScrollView>
    </View>
  );
}
