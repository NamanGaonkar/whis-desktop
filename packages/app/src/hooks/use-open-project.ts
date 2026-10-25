import { getHostRuntimeStore } from "@/runtime/host-runtime";
import { useCallback } from "react";
import { useHostRuntimeClient, useHostRuntimeIsConnected } from "@/runtime/host-runtime";
import { useSessionStore } from "@/stores/session-store";
import { getIsElectronRuntime } from "@/constants/layout";
import {
  cloneGithubProjectDirectly,
  openProjectDirectly,
  type OpenProjectResult,
  type ProjectGithubCloneProtocol,
} from "@/hooks/open-project";

export function useOpenProject(
  serverId: string | null,
): (path: string) => Promise<OpenProjectResult> {
  const store = getHostRuntimeStore();
  const normalizedServerId = store.resolveServerId(serverId ?? "");
  const client = useHostRuntimeClient(normalizedServerId);
  const isConnected = useHostRuntimeIsConnected(normalizedServerId);
  const canAddProject = useSessionStore((state) => {
    const session =
      state.sessions[normalizedServerId] ??
      (normalizedServerId === "local" ||
      !normalizedServerId ||
      Object.keys(state.sessions).length === 1
        ? Object.values(state.sessions)[0]
        : undefined);
    return (
      session?.serverInfo?.features?.projectAdd === true &&
      session?.serverInfo?.features?.stableProjectIdentity === true
    );
  });
  const upsertProject = useCallback(
    (
      targetServerId: string,
      project: Parameters<ReturnType<typeof getHostRuntimeStore>["acceptProjectSnapshot"]>[1],
    ) => {
      getHostRuntimeStore().acceptProjectSnapshot(targetServerId, project);
    },
    [],
  );
  const setHasHydratedWorkspaces = useSessionStore((state) => state.setHasHydratedWorkspaces);

  return useCallback(
    async (path: string) => {
      const activeServerId = store.resolveServerId(serverId ?? "");
      const liveClient = client ?? store.getClient(activeServerId);
      const liveConnected = isConnected || liveClient !== null || getIsElectronRuntime();
      const result = await openProjectDirectly({
        serverId: activeServerId,
        projectPath: path,
        isConnected: liveConnected,
        canAddProject: getIsElectronRuntime() || canAddProject,
        client: liveClient,
        upsertProject,
        setHasHydratedWorkspaces,
      });
      return result;
    },
    [store, serverId, upsertProject, canAddProject, client, isConnected, setHasHydratedWorkspaces],
  );
}

export function useCloneGithubProject(
  serverId: string | null,
): (
  repo: string,
  targetDirectory: string,
  cloneProtocol?: ProjectGithubCloneProtocol,
) => Promise<OpenProjectResult> {
  const normalizedServerId = serverId?.trim() ?? "";
  const client = useHostRuntimeClient(normalizedServerId);
  const isConnected = useHostRuntimeIsConnected(normalizedServerId);
  const upsertProject = useCallback(
    (
      targetServerId: string,
      project: Parameters<ReturnType<typeof getHostRuntimeStore>["acceptProjectSnapshot"]>[1],
    ) => {
      getHostRuntimeStore().acceptProjectSnapshot(targetServerId, project);
    },
    [],
  );
  const setHasHydratedWorkspaces = useSessionStore((state) => state.setHasHydratedWorkspaces);

  return useCallback(
    async (repo: string, targetDirectory: string, cloneProtocol?: ProjectGithubCloneProtocol) => {
      return cloneGithubProjectDirectly({
        serverId: normalizedServerId,
        repo,
        targetDirectory,
        ...(cloneProtocol ? { cloneProtocol } : {}),
        isConnected,
        client,
        upsertProject,
        setHasHydratedWorkspaces,
      });
    },
    [client, isConnected, normalizedServerId, setHasHydratedWorkspaces, upsertProject],
  );
}
