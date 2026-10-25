import { execFile } from "node:child_process"
import { readdir, stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import type { CustomMacSignOptions } from "app-builder-lib"
import { Arch, type Configuration } from "electron-builder"
import { NativeArch } from "../../script/native-arch"
import { CLI_BINARIES, getCurrentCli, nodePtyPackage } from "./scripts/utils"

const execFileAsync = promisify(execFile)

const packageDir = path.dirname(fileURLToPath(import.meta.url))

const rootDir = path.resolve(packageDir, "../..")

const signScript = path.join(rootDir, "script", "sign-windows.ps1")

const legacyDesktopEntry = path.join(packageDir, "resources", "linux", "whis-desktop.desktop")

const legacyDesktopEntryFpm = `${legacyDesktopEntry}=/usr/share/applications/whis-desktop.desktop`

const rpmNoBuildIdLinksFpm = "--rpm-rpmbuild-define=_build_id_links none"

const metainfoFpm = (appId: string) =>
  `${path.join(packageDir, "resources", `${appId}.metainfo.xml`)}=/usr/share/metainfo/${appId}.metainfo.xml`

async function signWindows(configuration: { path: string }) {
  if (process.platform !== "win32") return

  if (process.env.GITHUB_ACTIONS !== "true") return

  await execFileAsync(
    "pwsh",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", signScript, configuration.path],
    { cwd: rootDir, windowsHide: true },
  )
}

function macSignOptions(options: CustomMacSignOptions): CustomMacSignOptions {
  return {
    ...options,
    optionsForFile: (file) => {
      const defaults = options.optionsForFile?.(file)

      if (file !== path.join(options.app, "Contents/Resources/whis-cli") && file !== path.join(options.app, "Contents/Resources/opencode-cli")) return defaults ?? {}

      return { ...defaults, entitlements: path.join(packageDir, "resources/entitlements.cli.plist") }
    },
  }
}

function resolveChannel() {
  const raw = process.env.WHIS_CHANNEL ?? process.env.OPENCODE_CHANNEL

  if (raw === "dev" || raw === "beta" || raw === "prod") return raw

  if (raw === "latest") return "prod"

  return "prod"
}

const APP_IDS = {
  dev: "ai.whis.desktop.dev",
  beta: "ai.whis.desktop.beta",
  prod: "ai.whis.desktop",
} as const

function linuxExecutableName(appId: string): string {
  return appId.replace(/\.desktop$/, "")
}

const getBase = (appId: string): Configuration => {
  const target = getCurrentCli()

  return {
    artifactName: "whis-desktop-${os}-${arch}.${ext}",
    directories: {
      output: "dist",
      buildResources: "resources",
    },
    extraMetadata: {
      name: "Whis",
      productName: "Whis",
      version: "4.0.1",
      desktopName: `${appId}.desktop`,
    },
    files: [
      "out/**/*",
      "resources/**/*",
      "!resources/opencode-cli*",
      "!resources/whis-cli*",
      ...CLI_BINARIES.filter((item) => item.os !== target.os || item.cpu !== target.cpu).map(
        (item) => `!**/node_modules/@lydell/node-pty-${item.os}-${item.cpu}{,/**/*}`,
      ),
      "!**/node_modules/@zip.js/zip.js/dist{,/**/*}",
      "!**/node_modules/@zip.js/zip.js/{index.cjs,index.min.js,index-fflate.js,deno.json,eslint.config.mjs}",
      "!**/node_modules/**/*.d.{ts,cts,mts}",
      "!**/node_modules/**/*.d.{ts,cts,mts}.map",
      "!**/node_modules/**/*.{js,cjs,mjs}.map",
      "!**/node_modules/ajv/lib{,/**/*}",
      "!**/node_modules/ajv-formats/src{,/**/*}",
      "!**/node_modules/js-yaml/dist/{js-yaml.js,js-yaml.min.js,*.map}",
      "!**/node_modules/js-yaml/bin{,/**/*}",
    ],
    extraResources: [
      {
        from: "resources/",
        to: "",
        filter: ["opencode-cli", "opencode-cli.exe", "opencode-cli.version", "whis-cli", "whis-cli.exe", "whis-cli.version", "icons/**/*"],
      },
    ],
    afterPack: async (context) => {
      const arch = Arch[context.arch]

      if (arch !== "x64" && arch !== "arm64") throw new Error(`Unsupported desktop architecture: ${arch}`)

      if (arch !== target.cpu) throw new Error(`Packaging ${arch} Electron with the ${target.target} CLI`)
      const resources = context.packager.getResourcesDir(context.appOutDir)
      const cliName = context.electronPlatformName === "win32" ? "opencode-cli.exe" : "opencode-cli"
      const cli = path.join(resources, cliName)

      const file = await stat(cli).catch(() => undefined)

      if (!file || !file.isFile() || file.size === 0) {
        // Fallback to whis-cli if present
        const whisCli = path.join(resources, context.electronPlatformName === "win32" ? "whis-cli.exe" : "whis-cli")
        const whisFile = await stat(whisCli).catch(() => undefined)
        if (!whisFile || !whisFile.isFile() || whisFile.size === 0) {
          throw new Error(`Bundled CLI must be a non-empty file: ${cli}`)
        }
      }

      if (context.electronPlatformName !== "win32") return

      const prebuilds = path.join(
        resources,
        "app.asar.unpacked/node_modules",
        nodePtyPackage(target.target),
        "prebuilds",
        `${target.os}-${target.cpu}`,
      )

      const addon = path.join(prebuilds, "conpty.node")

      if ((await stat(addon)).size === 0) throw new Error(`Bundled node-pty must be a non-empty file: ${addon}`)
      const entries = await readdir(prebuilds, { recursive: true, withFileTypes: true })

      await Promise.all(
        entries
          .filter((entry) => entry.isFile())
          .map(async (entry) => {
            const file = path.join(entry.parentPath, entry.name)

            if (await NativeArch.isNative(file)) await NativeArch.verify(file, arch)
          }),
      )
    },
    mac: {
      category: "public.app-category.developer-tools",
      icon: `resources/icons/icon.icns`,
      extendInfo: {
        NSAutoFillRequiresTextContentTypeForOneTimeCodeOnMac: true,
      },
      hardenedRuntime: true,
      gatekeeperAssess: false,
      entitlements: "resources/entitlements.plist",
      entitlementsInherit: "resources/entitlements.plist",
      sign: async (options) => {
        const { sign } = await import("app-builder-lib/out/codeSign/macCodeSign")
        await sign(macSignOptions(options))
      },
      notarize: true,
      target: ["dmg", "zip"],
    },
    protocols: {
      name: "Whis",
      schemes: ["whis"],
    },
    win: {
      icon: `resources/icons/icon.ico`,
      executableName: "Whis",
      signtoolOptions: {
        sign: signWindows,
      },
      target: ["nsis", "dir"],
      verifyUpdateCodeSignature: false,
    },
    nsis: {
      include: path.join(packageDir, "resources", "windows", "installer.nsh"),
      oneClick: true,
      perMachine: false,
      installerIcon: `resources/icons/icon.ico`,
      installerHeaderIcon: `resources/icons/icon.ico`,
    },
    linux: {
      icon: `resources/icons`,
      category: "Development",
      executableName: "whis",
      syncDesktopName: true,
      desktop: {
        entry: {
          StartupWMClass: appId,
        },
      },
      target: ["AppImage", "deb", "rpm"],
    },
  }
}

export function getConfig() {
  const channel = resolveChannel()
  const appId = APP_IDS[channel]
  const base = getBase(appId)

  switch (channel) {
    case "dev": {
      return {
        ...base,
        appId,
        productName: "Whis Dev",
      }
    }

    case "beta": {
      return {
        ...base,
        appId,
        productName: "Whis Beta",
        protocols: { name: "Whis Beta", schemes: ["whis"] },
      }
    }

    case "prod": {
      return {
        ...base,
        appId,
        productName: "Whis",
        protocols: { name: "Whis", schemes: ["whis"] },
      }
    }
  }
}

export default getConfig()
