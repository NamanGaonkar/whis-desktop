export * as InstructionBuiltIns from "./builtins.js"

import { makeLocationNode } from "@opencode/util/effect/app-node"
import { Context, DateTime, Effect, Layer, Schema } from "effect"
import { Global } from "@opencode/util/global"
import { Location } from "../location.js"
import { Instructions } from "./index.js"

export interface Interface {
  readonly load: () => Effect.Effect<Instructions.List>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/InstructionBuiltIns") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const global = yield* Global.Service
    const location = yield* Location.Service
    return Service.of({
      load: () =>
        Effect.succeed(
          Instructions.combine([
            Instructions.make({
              key: Instructions.Key.make("core/date"),
              codec: Schema.toCodecJson(Schema.String),
              read: DateTime.nowAsDate.pipe(Effect.map((date) => date.toDateString())),
              render: {
                initial: (date) => `Today's date: ${date}`,
                changed: (_previous, date) => `Today's date is now: ${date}`,
              },
            }),
            Instructions.make({
              key: Instructions.Key.make("core/environment"),
              codec: Schema.toCodecJson(Schema.String),
              read: Effect.sync(() =>
                [
                  "<env>",
                  `  Working directory: ${location.directory}`,
                  `  Workspace root folder: ${location.project.directory}`,
                  `  Is directory a git repo: ${location.vcs?.type === "git" ? "yes" : "no"}`,
                  `  Platform: ${process.platform}`,
                  `  Prefer ${global.tmp} over generic system temporary directories such as /tmp; it is pre-created and approved for external access.`,
                  "</env>",
                ].join("\n"),
              ),
              render: {
                initial: (environment) =>
                  ["Here is some useful information about the environment you are running in:", environment].join("\n"),
                changed: (_previous, environment) =>
                  ["The environment you are running in is now:", environment].join("\n"),
              },
            }),
            Instructions.make({
              key: Instructions.Key.make("core/memory"),
              codec: Schema.toCodecJson(Schema.String),
              read: Effect.sync(() =>
                [
                  "<memory>",
                  "  Whis maintains persistent cross-chat memory across sessions.",
                  "  Global user preferences and profile: ~/.whis/memory/user_profile.md (also ~/.whis/memory/user_preferences.md).",
                  "  Project-specific conventions and context: .whis/memory/project_context.md.",
                  "  You are Whis. Never refer to opencode or opencode memory paths.",
                  "  When asked about stored user preferences, hobbies, favorites (such as Virat Kohli, Max Verstappen), or user name (Naman Gaonkar), rely directly on the loaded preferences from ~/.whis/memory/user_profile.md.",
                  "  When asked to remember a fact, user preference, or project convention across chats, use the save_memory tool.",
                  "</memory>",
                ].join("\n"),
              ),
              render: {
                initial: (memory) => ["Memory instructions:", memory].join("\n"),
                changed: (_previous, memory) => ["Memory instructions updated:", memory].join("\n"),
              },
            }),
          ]),
        ),
    })
  }),
)

export const node = makeLocationNode({ service: Service, layer, deps: [Global.node, Location.node] })
