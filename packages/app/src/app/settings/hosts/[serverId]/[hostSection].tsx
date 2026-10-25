import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { HostRouteBootstrapBoundary } from "@/components/host-route-bootstrap-boundary";
import { useLocalDaemonServerId } from "@/hooks/use-is-local-daemon";
import { useHosts } from "@/runtime/host-runtime";
import SettingsScreen from "@/screens/settings-screen";
import { normalizeHostSectionSlug } from "@/utils/host-routes";

export default function SettingsHostSectionRoute() {
  const params = useLocalSearchParams<{ serverId?: string; hostSection?: string }>();
  const rawServerId = typeof params.serverId === "string" ? params.serverId.trim() : "";
  const hosts = useHosts();
  const localServerId = useLocalDaemonServerId();
  const serverId =
    !rawServerId || rawServerId === "local"
      ? (localServerId ?? hosts[0]?.serverId ?? rawServerId)
      : rawServerId;
  const rawSection = typeof params.hostSection === "string" ? params.hostSection : "";
  const section = normalizeHostSectionSlug(rawSection) ?? "providers";
  const view = useMemo(() => ({ kind: "host" as const, serverId, section }), [serverId, section]);

  return (
    <HostRouteBootstrapBoundary>
      <SettingsScreen view={view} />
    </HostRouteBootstrapBoundary>
  );
}
