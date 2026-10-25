import { useCallback } from "react";
import { ProviderDiagnosticSheet } from "@/components/provider-diagnostic-sheet";
import { OverlayLayerProvider } from "@/lib/overlay-root";
import { useProviderSettingsStore } from "@/stores/provider-settings-store";
import { useHosts } from "@/runtime/host-runtime";
import { useLocalDaemonServerId } from "@/hooks/use-is-local-daemon";

export function ProviderSettingsHost() {
  const serverId = useProviderSettingsStore((state) => state.serverId);
  const provider = useProviderSettingsStore((state) => state.provider);
  const visible = useProviderSettingsStore((state) => state.visible);
  const overlayParentLayer = useProviderSettingsStore((state) => state.overlayParentLayer);
  const close = useProviderSettingsStore((state) => state.close);
  const hosts = useHosts();
  const localServerId = useLocalDaemonServerId();
  const effectiveServerId =
    !serverId || serverId === "local"
      ? (localServerId ?? hosts[0]?.serverId ?? serverId)
      : serverId;

  const handleClose = useCallback(() => {
    close();
  }, [close]);

  if (!effectiveServerId || !provider) {
    return null;
  }

  return (
    <OverlayLayerProvider layer={overlayParentLayer}>
      <ProviderDiagnosticSheet
        key={`${effectiveServerId}:${provider}`}
        provider={provider}
        serverId={effectiveServerId}
        visible={visible}
        onClose={handleClose}
      />
    </OverlayLayerProvider>
  );
}
