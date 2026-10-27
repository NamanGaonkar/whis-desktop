#!/usr/bin/env bun
import { $ } from "bun"
import path from "node:path"
import { copyBuiltCliToResources, downloadCliToResources, resolveChannel } from "./utils"

const channel = resolveChannel()

await $`bun ./scripts/copy-icons.ts ${channel}`

await $`bun ./scripts/copy-metainfo.ts ${channel}`

const localCliDist = path.resolve(import.meta.dirname, "../../cli/dist")
const dist =
  Bun.env.OPENCODE_CLI_DIST ??
  ((await Bun.file(path.join(localCliDist, "cli-windows-x64", "package.json")).exists()) ? localCliDist : undefined)

if (dist) {
  await copyBuiltCliToResources(dist)
} else if (channel === "dev" && !(await Bun.file("resources/whis-cli.exe").exists())) {
  await downloadCliToResources()
}
