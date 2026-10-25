import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, TextInput, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Brain, Check, RefreshCw, Save, Sparkles } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SettingsSection } from "@/components/settings/headings/settings-section";
import { settingsStyles } from "@/styles/settings";

type MemoryTab = "user_profile" | "project_context";

export function MemorySection() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [activeTab, setActiveTab] = useState<MemoryTab>("user_profile");
  const [userProfile, setUserProfile] = useState<string>("");
  const [projectContext, setProjectContext] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadMemory = useCallback(async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const desktop = (
        window as unknown as {
          paseoDesktop?: { invoke: (cmd: string, args?: any) => Promise<any> };
        }
      ).paseoDesktop;
      if (desktop?.invoke) {
        const data = await desktop.invoke("read_memory");
        if (data) {
          setUserProfile(data.userProfile ?? "");
          setProjectContext(data.projectContext ?? "");
        }
      }
    } catch (err) {
      console.warn("Failed to read memory:", err);
      setStatusMessage("Could not read local memory files.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMemory();
  }, [loadMemory]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const desktop = (
        window as unknown as {
          paseoDesktop?: { invoke: (cmd: string, args?: any) => Promise<any> };
        }
      ).paseoDesktop;
      if (desktop?.invoke) {
        await desktop.invoke("write_memory", {
          userProfile,
          projectContext,
        });
        setStatusMessage("Memory saved successfully! Injected into all Whis sessions.");
      }
    } catch (err) {
      console.error("Failed to write memory:", err);
      setStatusMessage("Failed to save memory.");
    } finally {
      setSaving(false);
    }
  }, [projectContext, userProfile]);

  const currentContent = activeTab === "user_profile" ? userProfile : projectContext;
  const setCurrentContent = activeTab === "user_profile" ? setUserProfile : setProjectContext;

  return (
    <SettingsSection title={t("settings.memory.title", "Persistent Memory")}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Brain size={20} color={theme.colors.accent} />
            <View>
              <Text style={styles.title}>
                {t("settings.memory.sectionTitle", "Whis Coder Agent Memory")}
              </Text>
              <Text style={styles.subtitle}>
                {t(
                  "settings.memory.subtitle",
                  "Stored in ~/.whis/memory/ and automatically injected into every coding prompt.",
                )}
              </Text>
            </View>
          </View>
          <View style={styles.activeBadge}>
            <Sparkles size={12} color={theme.colors.success} />
            <Text style={styles.activeBadgeText}>
              {t("settings.memory.active", "Active & Injected")}
            </Text>
          </View>
        </View>

        {/* Tab selection */}
        <View style={styles.tabsRow}>
          <Pressable
            onPress={() => setActiveTab("user_profile")}
            style={[styles.tabButton, activeTab === "user_profile" && styles.tabButtonActive]}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "user_profile" && styles.tabButtonTextActive,
              ]}
            >
              user_profile.md (Global Preferences)
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("project_context")}
            style={[styles.tabButton, activeTab === "project_context" && styles.tabButtonActive]}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "project_context" && styles.tabButtonTextActive,
              ]}
            >
              project_context.md (Project Rules)
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <LoadingSpinner size="small" color={theme.colors.foregroundMuted} />
            <Text style={styles.loadingText}>Loading memory...</Text>
          </View>
        ) : (
          <View style={styles.editorContainer}>
            <TextInput
              multiline
              value={currentContent}
              onChangeText={setCurrentContent}
              placeholder={
                activeTab === "user_profile"
                  ? "# User Profile\n\n- Coding style: Clean, functional\n- Preferred packages: React, TypeScript, Tailwind\n- Guidelines: Keep token efficiency high"
                  : "# Project Context\n\n- Current focus\n- Architecture notes\n- Known constraints"
              }
              placeholderTextColor={theme.colors.foregroundMuted}
              style={styles.textEditor}
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        {statusMessage ? (
          <View style={styles.statusRow}>
            <Check size={14} color={theme.colors.success} />
            <Text style={styles.statusText}>{statusMessage}</Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <Button
            variant="outline"
            size="sm"
            onPress={loadMemory}
            disabled={loading || saving}
            leftIcon={RefreshCw}
          >
            {t("settings.memory.reload", "Reload from Disk")}
          </Button>
          <Button
            variant="default"
            size="sm"
            onPress={handleSave}
            disabled={loading || saving}
            leftIcon={saving ? undefined : Save}
          >
            {saving
              ? t("settings.memory.saving", "Saving...")
              : t("settings.memory.save", "Save Memory")}
          </Button>
        </View>
      </View>
    </SettingsSection>
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
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing[2],
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[3],
    flex: 1,
  },
  title: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.foreground,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
    marginTop: 2,
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface2,
  },
  activeBadgeText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.success,
    fontWeight: theme.fontWeight.medium,
  },
  tabsRow: {
    flexDirection: "row",
    gap: theme.spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: theme.spacing[2],
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.md,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.surface2,
  },
  tabButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
  },
  tabButtonTextActive: {
    color: theme.colors.foreground,
    fontWeight: theme.fontWeight.medium,
  },
  editorContainer: {
    minHeight: 220,
    maxHeight: 400,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface0,
  },
  textEditor: {
    flex: 1,
    minHeight: 220,
    padding: theme.spacing[3],
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fontFamily.mono,
    color: theme.colors.foreground,
  },
  loadingBox: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing[2],
  },
  loadingText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.success,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: theme.spacing[2],
    marginTop: theme.spacing[1],
  },
}));
