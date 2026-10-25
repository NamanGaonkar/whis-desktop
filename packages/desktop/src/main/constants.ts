import { app } from "electron"

type Channel = "local" | "dev" | "beta" | "prod"

const raw = import.meta.env.OPENCODE_CHANNEL ?? import.meta.env.WHIS_CHANNEL

export const CHANNEL: Channel = raw === "local" || raw === "dev" || raw === "beta" || raw === "prod" ? raw : "prod"

export const VERSION = app.isPackaged ? app.getVersion() : (process.env.WHIS_VERSION ?? process.env.OPENCODE_VERSION ?? "4.0.8")

const appNames: Record<string, string> = {
  dev: "Whis Dev",
  beta: "Whis Beta",
  prod: "Whis",
}

const appIDs: Record<string, string> = {
  dev: "ai.whis.desktop.dev",
  beta: "ai.whis.desktop.beta",
  prod: "ai.whis.desktop",
}

export const APP_NAME = app.isPackaged ? appNames[CHANNEL] : "Whis"

export const APP_ID = app.isPackaged ? appIDs[CHANNEL] : "ai.whis.desktop"
