import { describe, expect } from "bun:test"
import { sql } from "drizzle-orm"
import { Effect } from "effect"
import { Bus } from "@opencode/core/bus"
import { Database } from "@opencode/core/database/database"
import { DatabaseSync } from "@opencode/core/database/sync"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { ProjectTable } from "@opencode/core/project/sql"
import { SessionProjector } from "@opencode/core/session/projector"
import { SessionStore } from "@opencode/core/session/store"
import { Project } from "@opencode/schema/project"
import { AbsolutePath } from "@opencode/schema/schema"
import { Session } from "@opencode/schema/session"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { testEffect } from "./lib/effect"

const it = testEffect(
  AppNodeBuilder.build(LayerNode.group([Database.node, Bus.node, SessionProjector.node, SessionStore.node]), [
    Bus.node.replace(Bus.configured({ persist: true })),
  ]),
)

describe("SessionBidirectionalSync", () => {
  it.effect("CLI-create then desktop-open", () =>
    Effect.gen(function* () {
      const database = yield* Database.Service
      const store = yield* SessionStore.Service
      const directory = AbsolutePath.make("/project")
      yield* database.db.insert(ProjectTable).values({ id: Project.ID.global, worktree: directory, sandboxes: [] }).run()

      const sessionID = "ses_cli_created_01"
      const now = Date.now()

      // 1. Whis CLI creates a session and sends messages into session, message, part
      yield* database.db.run(sql`
        INSERT INTO session (id, project_id, directory, title, version, cost, tokens_input, tokens_output, time_created, time_updated)
        VALUES (${sessionID}, 'global', '/project', 'CLI Chat', '4.0.4', 0, 0, 0, ${now}, ${now})
      `)

      const msgID1 = "msg_cli_u1"
      yield* database.db.run(sql`
        INSERT INTO message (id, session_id, time_created, time_updated, data)
        VALUES (${msgID1}, ${sessionID}, ${now}, ${now}, ${JSON.stringify({ role: "user", agent: "build" })})
      `)
      yield* database.db.run(sql`
        INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
        VALUES ('prt_cli_u1', ${msgID1}, ${sessionID}, ${now}, ${now}, ${JSON.stringify({ type: "text", text: "Hello from whis-cli!" })})
      `)

      const msgID2 = "msg_cli_a1"
      yield* database.db.run(sql`
        INSERT INTO message (id, session_id, time_created, time_updated, data)
        VALUES (${msgID2}, ${sessionID}, ${now + 10}, ${now + 20}, ${JSON.stringify({ role: "assistant", agent: "build" })})
      `)
      yield* database.db.run(sql`
        INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
        VALUES ('prt_cli_a1', ${msgID2}, ${sessionID}, ${now + 10}, ${now + 20}, ${JSON.stringify({ type: "text", text: "Hello! Whis Desktop can see this." })})
      `)

      // 2. Whis Desktop opens the session: messages should be reconciled into session_message
      const messages = yield* store.messages({ sessionID: Session.ID.make(sessionID), order: "asc" })
      expect(messages.length).toBe(2)
      expect(messages[0]?.type).toBe("user")
      expect(messages[0]?.text).toBe("Hello from whis-cli!")
      expect(messages[1]?.type).toBe("assistant")

      // Check session_v2 also contains this session
      const sess = yield* store.get(Session.ID.make(sessionID))
      expect(sess?.title).toBe("CLI Chat")
    }),
  )

  it.effect("Desktop-create then CLI-open", () =>
    Effect.gen(function* () {
      const database = yield* Database.Service
      const directory = AbsolutePath.make("/project")
      yield* database.db.insert(ProjectTable).values({ id: Project.ID.global, worktree: directory, sandboxes: [] }).run()

      const sessionID = "ses_desk_created_02"
      const now = Date.now()

      // 1. Whis Desktop creates session in session_v2 and session_message
      yield* database.db.run(sql`
        INSERT INTO session_v2 (id, project_id, directory, slug, title, version, cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write, time_created, time_updated)
        VALUES (${sessionID}, 'global', '/project', 'desktop-chat', 'Desktop Chat', '4.0.4', 0, 0, 0, 0, 0, 0, ${now}, ${now})
      `)
      yield* database.db.run(sql`
        INSERT INTO session_message (id, session_id, type, seq, time_created, time_updated, data)
        VALUES ('msg_desk_u1', ${sessionID}, 'user', 0, ${now}, ${now}, ${JSON.stringify({ version: 1, text: "Created in Desktop!", time: { created: now } })})
      `)
      yield* database.db.run(sql`
        INSERT INTO session_message (id, session_id, type, seq, time_created, time_updated, data)
        VALUES ('msg_desk_a1', ${sessionID}, 'assistant', 1, ${now + 10}, ${now + 20}, ${JSON.stringify({ version: 1, agent: "build", model: { id: "whis", providerID: "local" }, content: [{ type: "text", text: "Assistant reply in Desktop" }], time: { created: now + 10, completed: now + 20 } })})
      `)

      // 2. Reconcile runs (via DatabaseSync.syncAll or store.list)
      yield* DatabaseSync.syncAll(database.db)

      // 3. Whis CLI reads from session, message, part
      const cliSession = yield* database.db.get<{ id: string; title: string }>(
        sql`SELECT id, title FROM session WHERE id = ${sessionID}`
      )
      expect(cliSession?.id).toBe(sessionID)

      const cliMessages = yield* database.db.all<{ id: string; session_id: string }>(
        sql`SELECT id, session_id FROM message WHERE session_id = ${sessionID} ORDER BY time_created ASC`
      )
      expect(cliMessages.length).toBe(2)

      const cliParts = yield* database.db.all<{ message_id: string; data: string }>(
        sql`SELECT message_id, data FROM part WHERE session_id = ${sessionID} ORDER BY time_created ASC`
      )
      expect(cliParts.some((p) => p.data.includes("Created in Desktop!"))).toBe(true)
    }),
  )

  it.effect("Continue in either app without creating duplicate sessions or messages", () =>
    Effect.gen(function* () {
      const database = yield* Database.Service
      const store = yield* SessionStore.Service
      const directory = AbsolutePath.make("/project")
      yield* database.db.insert(ProjectTable).values({ id: Project.ID.global, worktree: directory, sandboxes: [] }).run()

      const sessionID = "ses_continue_03"
      let time = Date.now()

      // Start in CLI
      yield* database.db.run(sql`
        INSERT INTO session (id, project_id, directory, title, version, cost, tokens_input, tokens_output, time_created, time_updated)
        VALUES (${sessionID}, 'global', '/project', 'Shared Chat', '4.0.4', 0, 0, 0, ${time}, ${time})
      `)
      yield* database.db.run(sql`
        INSERT INTO message (id, session_id, time_created, time_updated, data)
        VALUES ('msg_c1', ${sessionID}, ${time}, ${time}, ${JSON.stringify({ role: "user" })})
      `)
      yield* database.db.run(sql`
        INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
        VALUES ('prt_c1', 'msg_c1', ${sessionID}, ${time}, ${time}, ${JSON.stringify({ type: "text", text: "Turn 1 in CLI" })})
      `)

      // Open in Desktop
      let msgs = yield* store.messages({ sessionID: Session.ID.make(sessionID) })
      expect(msgs.length).toBe(1)
      expect(msgs[0]?.text).toBe("Turn 1 in CLI")

      // Continue in Desktop: Desktop writes Turn 2
      time += 1000
      yield* database.db.run(sql`
        INSERT INTO session_message (id, session_id, type, seq, time_created, time_updated, data)
        VALUES ('msg_d2', ${sessionID}, 'user', 1, ${time}, ${time}, ${JSON.stringify({ version: 1, text: "Turn 2 in Desktop", time: { created: time } })})
      `)

      // Sync and check in CLI
      yield* DatabaseSync.syncAll(database.db)
      const cliMsgs = yield* database.db.all<{ id: string }>(
        sql`SELECT id FROM message WHERE session_id = ${sessionID}`
      )
      expect(cliMsgs.length).toBe(2)

      // Continue in CLI: CLI writes Turn 3
      time += 1000
      yield* database.db.run(sql`
        INSERT INTO message (id, session_id, time_created, time_updated, data)
        VALUES ('msg_c3', ${sessionID}, ${time}, ${time}, ${JSON.stringify({ role: "user" })})
      `)
      yield* database.db.run(sql`
        INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
        VALUES ('prt_c3', 'msg_c3', ${sessionID}, ${time}, ${time}, ${JSON.stringify({ type: "text", text: "Turn 3 in CLI" })})
      `)

      // Re-read in Desktop
      msgs = yield* store.messages({ sessionID: Session.ID.make(sessionID), order: "asc" })
      expect(msgs.length).toBe(3)
      expect(msgs.map((m) => m.text)).toEqual(["Turn 1 in CLI", "Turn 2 in Desktop", "Turn 3 in CLI"])
    }),
  )
})
