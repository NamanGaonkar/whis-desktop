import { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ImportSessionSheet } from "@/components/import-session-sheet";
import { useHostChooser } from "@/hosts/host-chooser";
import { useHostRuntimeClient, useHosts } from "@/runtime/host-runtime";
import { useLocalDaemonServerId } from "@/hooks/use-is-local-daemon";
import { navigateToAgent } from "@/utils/navigate-to-agent";
import { useOpenProject } from "@/hooks/use-open-project";

interface UseImportSessionOptions {
  serverId?: string;
  cwd?: string;
  workspaceId?: string;
}

interface UseImportSessionResult {
  open: () => void;
  sheet: ReactNode;
}

interface ImportedAgentTarget {
  id: string;
  cwd: string;
}

/**
 * Sends the user to an agent that belongs to a workspace other than the one they
 * are looking at. The imported session's own directory decides the destination,
 * so the project has to exist before the route can resolve.
 */
export function useNavigateToImportedAgent(
  serverId: string | null | undefined,
): (agent: ImportedAgentTarget) => Promise<void> {
  const normalizedServerId = serverId?.trim() || null;
  const openProject = useOpenProject(normalizedServerId);

  return useCallback(
    async (agent: ImportedAgentTarget) => {
      if (!normalizedServerId) return;
      const project = await openProject(agent.cwd);
      if (project.ok) {
        navigateToAgent({ serverId: normalizedServerId, agentId: agent.id });
      }
    },
    [normalizedServerId, openProject],
  );
}

export function useImportSession({
  serverId,
  cwd,
  workspaceId,
}: UseImportSessionOptions = {}): UseImportSessionResult {
  const { t } = useTranslation();
  const chooseHost = useHostChooser();
  const hosts = useHosts();
  const localServerId = useLocalDaemonServerId();
  const [importServerId, setImportServerId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const client = useHostRuntimeClient(importServerId ?? "");
  const navigateToImportedAgent = useNavigateToImportedAgent(importServerId);

  const openForHost = useCallback((chosenServerId: string) => {
    setImportServerId(chosenServerId);
    setIsSheetOpen(true);
  }, []);

  const open = useCallback(() => {
    const effectiveServerId =
      localServerId ??
      (serverId && serverId !== "local" ? serverId : null) ??
      hosts[0]?.serverId ??
      "local";
    if (effectiveServerId) {
      openForHost(effectiveServerId);
      return;
    }
    chooseHost({
      title: t("importSession.chooseHostTitle"),
      onChooseHost: openForHost,
    });
  }, [chooseHost, hosts, localServerId, openForHost, serverId, t]);

  const close = useCallback(() => setIsSheetOpen(false), []);

  return {
    open,
    sheet: (
      <ImportSessionSheet
        visible={isSheetOpen}
        client={client}
        serverId={importServerId}
        cwd={cwd}
        workspaceId={workspaceId}
        onClose={close}
        onImported={navigateToImportedAgent}
      />
    ),
  };
}
