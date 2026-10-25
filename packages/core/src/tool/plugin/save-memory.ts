export * as SaveMemoryTool from "./save-memory.js"

import type { Context } from "@opencode/plugin/effect/plugin"
import { ToolFailure } from "@opencode/ai/effect"
import { FSUtil } from "@opencode/util/fs-util"
import { Global } from "@opencode/util/global"
import { Effect, Schema } from "effect"
import { join } from "path"
import { Location } from "../../location.js"
import { Permission } from "../../permission.js"

export const name = "save_memory"

export const Input = Schema.Struct({
  fact: Schema.String.annotate({
    description: "The user preference, coding convention, architecture decision, or fact to remember across sessions",
  }),
  type: Schema.optional(
    Schema.Literals(["user_profile", "project_context"]).annotate({
      description:
        "The target memory destination. 'user_profile' stores global user preferences (~/.whis/memory/user_profile.md). 'project_context' stores project-specific conventions (.whis/memory/project_context.md). Defaults to 'user_profile'.",
    }),
  ),
  section: Schema.optional(
    Schema.String.annotate({
      description:
        "Optional section heading in the memory file under which to place this memory (e.g., Tooling, Styling, Coding style, Conventions)",
    }),
  ),
})
export type Input = typeof Input.Type

export const Output = Schema.Struct({
  target: Schema.String,
  fact: Schema.String,
  type: Schema.String,
})
export type Output = typeof Output.Type

export const Plugin = {
  id: "opencode.tool.save_memory",
  effect: Effect.fn("SaveMemoryTool.Plugin")(function* (ctx: Context) {
    const fs = yield* FSUtil.Service
    const global = yield* Global.Service
    const location = yield* Location.Service
    const permission = yield* Permission.Service

    yield* ctx.tool.transform((editor) =>
      editor.add({
        name,
        options: { codemode: false },
        description:
          "Save a persistent fact, user preference, or project convention to Whis memory. Memories persist across all chats and sessions and are loaded automatically on every prompt. Use 'user_profile' for global user preferences and 'project_context' for project-specific rules.",
        input: Input,
        output: Output,
        execute: (input, context) =>
          Effect.gen(function* () {
            const memoryType = input.type ?? "user_profile"
            const memoryDir =
              memoryType === "user_profile"
                ? join(global.home, ".whis", "memory")
                : join(location.project.directory, ".whis", "memory")
            const targetFile =
              memoryType === "user_profile"
                ? join(memoryDir, "user_profile.md")
                : join(memoryDir, "project_context.md")

            yield* permission.assert({
              action: name,
              resources: [targetFile],
              save: [targetFile],
              sessionID: context.sessionID,
              agent: context.agent,
              source: { type: "tool", messageID: context.messageID, id: context.id },
            })

            yield* fs.ensureDir(memoryDir)
            const existing = (yield* fs.readFileStringSafe(targetFile)) ?? ""
            const bullet = `- ${input.fact.trim()}`
            let nextContent: string

            if (!existing.trim()) {
              const title = memoryType === "user_profile" ? "User profile" : "Project context"
              const desc =
                memoryType === "user_profile"
                  ? "Preferences that persist across every WHIS session. Edit freely - WHIS reads this file on every prompt."
                  : "Architecture decisions, conventions and known quirks for this repo. Edit freely - WHIS reads this file on every prompt."
              const sectionHeader = input.section ? `\n\n## ${input.section}\n\n` : "\n\n"
              nextContent = `# ${title}\n\n_${desc}_\n${sectionHeader}${bullet}\n`
            } else if (input.section && existing.includes(`## ${input.section}`)) {
              const escaped = input.section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
              const regex = new RegExp(`(##\\s+${escaped}[\\r\\n]+)`, "i")
              nextContent = existing.replace(regex, `$1${bullet}\n\n`)
            } else if (input.section) {
              nextContent = `${existing.trimEnd()}\n\n## ${input.section}\n\n${bullet}\n`
            } else {
              nextContent = `${existing.trimEnd()}\n\n${bullet}\n`
            }

            yield* fs.writeWithDirs(targetFile, nextContent)

            return {
              target: targetFile,
              fact: input.fact,
              type: memoryType,
            }
          }).pipe(
            Effect.map((output) => ({
              output,
              content: `Saved memory to ${output.target}: "${output.fact}"`,
            })),
            Effect.mapError((error) => new ToolFailure({ message: "Unable to save memory", error })),
          ),
      }),
    )
  }),
}
