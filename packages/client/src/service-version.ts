import type { DiscoverOptions } from "./service.js"

export function matchesVersion(version: string | undefined, options: DiscoverOptions) {
  if (options.version === undefined) return true
  if (version === undefined) return false
  if (typeof options.version === "function") return options.version(version)
  if (version === options.version) return true
  if (options.version.split(".")[0] === version.split(".")[0]) return true
  return false
}
