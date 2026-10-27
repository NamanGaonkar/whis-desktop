export * as DatabaseSync from "./sync.js"

import { sql } from "drizzle-orm"
import { DateTime, Effect } from "effect"
import { SessionMessage } from "../session/message.js"
import type { EffectDrizzleSqlite } from "./drizzle.js"

type Database = EffectDrizzleSqlite.EffectSQLiteDatabase

export function installTriggers(db: Database) {
  return Effect.gen(function* () {
    yield* db.run(sql`
      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        workspace_id TEXT,
        parent_id TEXT,
        slug TEXT,
        directory TEXT,
        path TEXT,
        title TEXT,
        version TEXT,
        share_url TEXT,
        summary_additions INTEGER,
        summary_deletions INTEGER,
        summary_files INTEGER,
        summary_diffs TEXT,
        metadata TEXT,
        cost REAL,
        tokens_input INTEGER,
        tokens_output INTEGER,
        tokens_reasoning INTEGER,
        tokens_cache_read INTEGER,
        tokens_cache_write INTEGER,
        revert TEXT,
        permission TEXT,
        agent TEXT,
        model TEXT,
        time_created INTEGER NOT NULL,
        time_updated INTEGER NOT NULL,
        time_compacting INTEGER,
        time_archived INTEGER
      )
    `).pipe(Effect.orDie)

    yield* db.run(sql`
      CREATE TABLE IF NOT EXISTS message (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        time_created INTEGER NOT NULL,
        time_updated INTEGER NOT NULL,
        data TEXT NOT NULL
      )
    `).pipe(Effect.orDie)

    yield* db.run(sql`
      CREATE TABLE IF NOT EXISTS part (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        time_created INTEGER NOT NULL,
        time_updated INTEGER NOT NULL,
        data TEXT NOT NULL
      )
    `).pipe(Effect.orDie)

    yield* db.run(sql`
      CREATE TRIGGER IF NOT EXISTS sync_session_to_v2_insert
      AFTER INSERT ON session
      FOR EACH ROW
      WHEN NOT EXISTS (SELECT 1 FROM session_v2 WHERE id = NEW.id)
      BEGIN
        INSERT INTO session_v2 (
          id, project_id, workspace_id, parent_id, slug, directory, path, title, version,
          share_url, summary_additions, summary_deletions, summary_files, summary_diffs,
          metadata, cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read,
          tokens_cache_write, revert, permission, agent, model, time_created, time_updated,
          time_compacting, time_archived
        ) VALUES (
          NEW.id,
          COALESCE((SELECT id FROM project WHERE id = NEW.project_id), 'global'),
          NEW.workspace_id,
          NEW.parent_id,
          COALESCE(NEW.slug, 'session'),
          COALESCE(NEW.directory, ''),
          NEW.path,
          NEW.title,
          COALESCE(NEW.version, '4.0.4'),
          NEW.share_url,
          NEW.summary_additions,
          NEW.summary_deletions,
          NEW.summary_files,
          NEW.summary_diffs,
          NEW.metadata,
          COALESCE(NEW.cost, 0),
          COALESCE(NEW.tokens_input, 0),
          COALESCE(NEW.tokens_output, 0),
          COALESCE(NEW.tokens_reasoning, 0),
          COALESCE(NEW.tokens_cache_read, 0),
          COALESCE(NEW.tokens_cache_write, 0),
          NEW.revert,
          NEW.permission,
          NEW.agent,
          NEW.model,
          NEW.time_created,
          NEW.time_updated,
          NEW.time_compacting,
          NEW.time_archived
        );
      END
    `)

    yield* db.run(sql`
      CREATE TRIGGER IF NOT EXISTS sync_session_to_v2_update
      AFTER UPDATE ON session
      FOR EACH ROW
      WHEN (
        OLD.time_updated <> NEW.time_updated OR
        OLD.title IS NOT NEW.title OR
        OLD.cost <> NEW.cost OR
        OLD.tokens_input <> NEW.tokens_input OR
        OLD.tokens_output <> NEW.tokens_output OR
        OLD.time_archived IS NOT NEW.time_archived
      )
      BEGIN
        UPDATE session_v2 SET
          title = COALESCE(NEW.title, title),
          cost = COALESCE(NEW.cost, 0),
          tokens_input = COALESCE(NEW.tokens_input, 0),
          tokens_output = COALESCE(NEW.tokens_output, 0),
          tokens_reasoning = COALESCE(NEW.tokens_reasoning, 0),
          tokens_cache_read = COALESCE(NEW.tokens_cache_read, 0),
          tokens_cache_write = COALESCE(NEW.tokens_cache_write, 0),
          time_updated = NEW.time_updated,
          time_compacting = NEW.time_compacting,
          time_archived = NEW.time_archived
        WHERE id = NEW.id;
      END
    `)

    yield* db.run(sql`
      CREATE TRIGGER IF NOT EXISTS sync_session_to_v2_delete
      AFTER DELETE ON session
      FOR EACH ROW
      BEGIN
        DELETE FROM session_v2 WHERE id = OLD.id;
      END
    `)

    yield* db.run(sql`
      CREATE TRIGGER IF NOT EXISTS sync_v2_to_session_insert
      AFTER INSERT ON session_v2
      FOR EACH ROW
      WHEN NOT EXISTS (SELECT 1 FROM session WHERE id = NEW.id)
      BEGIN
        INSERT INTO session (
          id, project_id, workspace_id, parent_id, slug, directory, path, title, version,
          share_url, summary_additions, summary_deletions, summary_files, summary_diffs,
          metadata, cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read,
          tokens_cache_write, revert, permission, agent, model, time_created, time_updated,
          time_compacting, time_archived
        ) VALUES (
          NEW.id,
          COALESCE((SELECT id FROM project WHERE id = NEW.project_id), 'global'),
          NEW.workspace_id,
          NEW.parent_id,
          COALESCE(NEW.slug, 'session'),
          COALESCE(NEW.directory, ''),
          NEW.path,
          COALESCE(NEW.title, 'New Session'),
          COALESCE(NEW.version, '4.0.4'),
          NEW.share_url,
          NEW.summary_additions,
          NEW.summary_deletions,
          NEW.summary_files,
          NEW.summary_diffs,
          NEW.metadata,
          COALESCE(NEW.cost, 0),
          COALESCE(NEW.tokens_input, 0),
          COALESCE(NEW.tokens_output, 0),
          COALESCE(NEW.tokens_reasoning, 0),
          COALESCE(NEW.tokens_cache_read, 0),
          COALESCE(NEW.tokens_cache_write, 0),
          NEW.revert,
          NEW.permission,
          NEW.agent,
          NEW.model,
          NEW.time_created,
          NEW.time_updated,
          NEW.time_compacting,
          NEW.time_archived
        );
      END
    `)

    yield* db.run(sql`
      CREATE TRIGGER IF NOT EXISTS sync_v2_to_session_update
      AFTER UPDATE ON session_v2
      FOR EACH ROW
      WHEN (
        OLD.time_updated <> NEW.time_updated OR
        OLD.title IS NOT NEW.title OR
        OLD.cost <> NEW.cost OR
        OLD.tokens_input <> NEW.tokens_input OR
        OLD.tokens_output <> NEW.tokens_output OR
        OLD.time_archived IS NOT NEW.time_archived
      )
      BEGIN
        UPDATE session SET
          title = COALESCE(NEW.title, 'New Session'),
          cost = NEW.cost,
          tokens_input = NEW.tokens_input,
          tokens_output = NEW.tokens_output,
          tokens_reasoning = NEW.tokens_reasoning,
          tokens_cache_read = NEW.tokens_cache_read,
          tokens_cache_write = NEW.tokens_cache_write,
          time_updated = NEW.time_updated,
          time_compacting = NEW.time_compacting,
          time_archived = NEW.time_archived
        WHERE id = NEW.id;
      END
    `)

    yield* db.run(sql`
      CREATE TRIGGER IF NOT EXISTS sync_v2_to_session_delete
      AFTER DELETE ON session_v2
      FOR EACH ROW
      BEGIN
        DELETE FROM session WHERE id = OLD.id;
      END
    `)

    yield* db.run(sql`DROP TRIGGER IF EXISTS sync_part_touch_session`).pipe(Effect.orDie)
    yield* db.run(sql`DROP TRIGGER IF EXISTS sync_message_touch_session`).pipe(Effect.orDie)
    yield* db.run(sql`DROP TRIGGER IF EXISTS sync_v2_message_touch_session`).pipe(Effect.orDie)

    yield* db.run(sql`
      CREATE TRIGGER IF NOT EXISTS sync_message_touch_session
      AFTER INSERT ON message
      FOR EACH ROW
      WHEN (json_extract(NEW.data, '$.role') = 'user' OR json_extract(NEW.data, '$.role') = 'assistant')
      BEGIN
        UPDATE session SET time_updated = MAX(time_updated, NEW.time_updated) WHERE id = NEW.session_id;
        UPDATE session_v2 SET time_updated = MAX(time_updated, NEW.time_updated) WHERE id = NEW.session_id;
      END
    `)

    yield* db.run(sql`
      CREATE TRIGGER IF NOT EXISTS sync_v2_message_touch_session
      AFTER INSERT ON session_message
      FOR EACH ROW
      WHEN (NEW.type = 'user' OR NEW.type = 'assistant')
      BEGIN
        UPDATE session SET time_updated = MAX(time_updated, NEW.time_updated) WHERE id = NEW.session_id;
        UPDATE session_v2 SET time_updated = MAX(time_updated, NEW.time_updated) WHERE id = NEW.session_id;
      END
    `)
  })
}

export function reconcileSessions(db: Database) {
  return Effect.gen(function* () {
    // Repair any session timestamps artificially bumped into the future
    yield* db.run(sql`
      UPDATE session
      SET time_updated = (
        SELECT COALESCE(MAX(sub.max_time), session.time_created)
        FROM (
          SELECT MAX(time_created) as max_time FROM message WHERE session_id = session.id
          UNION ALL
          SELECT MAX(time_created) as max_time FROM session_message WHERE session_id = session.id
        ) sub
        WHERE sub.max_time IS NOT NULL
      )
      WHERE id IN (
        SELECT s.id
        FROM session s
        WHERE s.time_updated > (
          SELECT COALESCE(MAX(sub.max_time), s.time_created)
          FROM (
            SELECT MAX(time_created) as max_time FROM message WHERE session_id = s.id
            UNION ALL
            SELECT MAX(time_created) as max_time FROM session_message WHERE session_id = s.id
          ) sub
          WHERE sub.max_time IS NOT NULL
        ) + 60000
      );
    `).pipe(Effect.orDie)

    yield* db.run(sql`
      UPDATE session_v2
      SET time_updated = (
        SELECT COALESCE(MAX(sub.max_time), session_v2.time_created)
        FROM (
          SELECT MAX(time_created) as max_time FROM message WHERE session_id = session_v2.id
          UNION ALL
          SELECT MAX(time_created) as max_time FROM session_message WHERE session_id = session_v2.id
        ) sub
        WHERE sub.max_time IS NOT NULL
      )
      WHERE id IN (
        SELECT s.id
        FROM session_v2 s
        WHERE s.time_updated > (
          SELECT COALESCE(MAX(sub.max_time), s.time_created)
          FROM (
            SELECT MAX(time_created) as max_time FROM message WHERE session_id = s.id
            UNION ALL
            SELECT MAX(time_created) as max_time FROM session_message WHERE session_id = s.id
          ) sub
          WHERE sub.max_time IS NOT NULL
        ) + 60000
      );
    `).pipe(Effect.orDie)
    // Copy any CLI sessions into session_v2
    yield* db.run(sql`
      INSERT OR IGNORE INTO session_v2 (
        id, project_id, workspace_id, parent_id, slug, directory, path, title, version,
        share_url, summary_additions, summary_deletions, summary_files, summary_diffs,
        metadata, cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read,
        tokens_cache_write, revert, permission, agent, model, time_created, time_updated,
        time_compacting, time_archived
      )
      SELECT 
        s.id,
        COALESCE((SELECT p.id FROM project p WHERE p.id = s.project_id), 'global'),
        s.workspace_id,
        s.parent_id,
        COALESCE(s.slug, 'session'),
        COALESCE(s.directory, ''),
        s.path,
        s.title,
        COALESCE(s.version, '4.0.4'),
        s.share_url,
        s.summary_additions,
        s.summary_deletions,
        s.summary_files,
        s.summary_diffs,
        s.metadata,
        COALESCE(s.cost, 0),
        COALESCE(s.tokens_input, 0),
        COALESCE(s.tokens_output, 0),
        COALESCE(s.tokens_reasoning, 0),
        COALESCE(s.tokens_cache_read, 0),
        COALESCE(s.tokens_cache_write, 0),
        s.revert,
        s.permission,
        s.agent,
        s.model,
        s.time_created,
        s.time_updated,
        s.time_compacting,
        s.time_archived
      FROM session s
      WHERE NOT EXISTS (SELECT 1 FROM session_v2 WHERE id = s.id)
    `).pipe(Effect.orDie)

    // Copy any Desktop sessions into session
    yield* db.run(sql`
      INSERT OR IGNORE INTO session (
        id, project_id, workspace_id, parent_id, slug, directory, path, title, version,
        share_url, summary_additions, summary_deletions, summary_files, summary_diffs,
        metadata, cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read,
        tokens_cache_write, revert, permission, agent, model, time_created, time_updated,
        time_compacting, time_archived
      )
      SELECT 
        v.id,
        COALESCE((SELECT p.id FROM project p WHERE p.id = v.project_id), 'global'),
        v.workspace_id,
        v.parent_id,
        COALESCE(v.slug, 'session'),
        COALESCE(v.directory, ''),
        v.path,
        COALESCE(v.title, 'New Session'),
        COALESCE(v.version, '4.0.4'),
        v.share_url,
        v.summary_additions,
        v.summary_deletions,
        v.summary_files,
        v.summary_diffs,
        v.metadata,
        COALESCE(v.cost, 0),
        COALESCE(v.tokens_input, 0),
        COALESCE(v.tokens_output, 0),
        COALESCE(v.tokens_reasoning, 0),
        COALESCE(v.tokens_cache_read, 0),
        COALESCE(v.tokens_cache_write, 0),
        v.revert,
        v.permission,
        v.agent,
        v.model,
        v.time_created,
        v.time_updated,
        v.time_compacting,
        v.time_archived
      FROM session_v2 v
      WHERE NOT EXISTS (SELECT 1 FROM session WHERE id = v.id)
    `).pipe(Effect.orDie)
  }).pipe(Effect.orDie)
}

export function reconcileSessionV1Messages(db: Database, sessionID: string) {
  return Effect.gen(function* () {
    // 1. Reconcile missing V1 messages into session_message
    const missingV1 = yield* db.all<{
      id: string
      session_id: string
      time_created: number
      time_updated: number
      data: string
    }>(sql`
      SELECT id, session_id, time_created, time_updated, data
      FROM message
      WHERE session_id = ${sessionID}
        AND id NOT IN (SELECT id FROM session_message WHERE session_id = ${sessionID})
      ORDER BY time_created ASC
    `).pipe(Effect.orDie)

    if (missingV1 && missingV1.length > 0) {
      const parts = yield* db.all<{
        id: string
        message_id: string
        session_id: string
        time_created: number
        time_updated: number
        data: string
      }>(sql`
        SELECT id, message_id, session_id, time_created, time_updated, data
        FROM part
        WHERE session_id = ${sessionID}
        ORDER BY time_created ASC
      `).pipe(Effect.orDie)

      const partsByMsg = new Map<string, Array<{ id: string; time_created: number; data: any }>>()
      for (const p of parts) {
        const list = partsByMsg.get(p.message_id) ?? []
        let parsed: any = {}
        try {
          parsed = typeof p.data === "string" ? JSON.parse(p.data) : p.data
        } catch {
          parsed = {}
        }
        list.push({ id: p.id, time_created: p.time_created, data: parsed })
        partsByMsg.set(p.message_id, list)
      }

      const seqRow = yield* db.get<{ max_seq: number | null }>(sql`
        SELECT MAX(seq) AS max_seq FROM session_message WHERE session_id = ${sessionID}
      `).pipe(Effect.orDie)
      let nextSeq = (seqRow?.max_seq !== null && seqRow?.max_seq !== undefined ? seqRow.max_seq : -1) + 1

      for (const m of missingV1) {
        let msgData: any = {}
        try {
          msgData = typeof m.data === "string" ? JSON.parse(m.data) : m.data
        } catch {
          msgData = {}
        }

        const msgParts = partsByMsg.get(m.id) ?? []

        if (msgData.role === "user") {
          const text = msgParts
            .filter((p) => p.data.type === "text" && !p.data.ignored)
            .map((p) => p.data.text || "")
            .join("\n\n")

          const payload = {
            version: 1,
            text,
            time: { created: m.time_created },
            ...(msgData.agent ? { agent: msgData.agent } : {}),
            ...(msgData.model ? { model: msgData.model } : {}),
          }

          yield* db.run(sql`
            INSERT INTO session_message (id, session_id, type, seq, time_created, time_updated, data)
            VALUES (${m.id}, ${sessionID}, 'user', ${nextSeq++}, ${m.time_created}, ${m.time_updated}, ${JSON.stringify(payload)})
            ON CONFLICT(id) DO NOTHING
          `).pipe(Effect.orDie)
        } else if (msgData.role === "assistant") {
          const content: any[] = []
          let startSnapshot: string | undefined
          let endSnapshot: string | undefined

          for (const p of msgParts) {
            const pType = p.data.type
            if (pType === "step-start") {
              startSnapshot = p.data.snapshot
            } else if (pType === "step-finish") {
              endSnapshot = p.data.snapshot
            } else if (pType === "reasoning") {
              content.push({
                type: "reasoning",
                text: p.data.text || "",
                time: {
                  created: p.data.time?.start || p.time_created,
                  ...(p.data.time?.end ? { completed: p.data.time.end } : {}),
                },
              })
            } else if (pType === "text") {
              content.push({
                type: "text",
                text: p.data.text || "",
              })
            } else if (pType === "tool") {
              const toolState = p.data.state
              let normalizedState: any = {
                status: "completed",
                input: {},
                content: [{ type: "text", text: "" }],
              }
              if (typeof toolState === "object" && toolState !== null) {
                if (toolState.status === "error") {
                  let err = toolState.error
                  if (typeof err !== "object" || err === null || typeof err.type !== "string" || typeof err.message !== "string") {
                    err = { type: "tool.execution", message: typeof err === "string" ? err : (err?.message || "Tool execution failed") }
                  }
                  normalizedState = {
                    status: "error",
                    input: toolState.input ?? {},
                    error: err,
                    ...(Array.isArray(toolState.content) && toolState.content.length > 0 ? { content: toolState.content } : {}),
                    ...(toolState.metadata ? { metadata: toolState.metadata } : {}),
                  }
                } else if (toolState.status === "running") {
                  normalizedState = {
                    status: "running",
                    input: toolState.input ?? {},
                    metadata: toolState.metadata ?? {},
                  }
                } else if (toolState.status === "streaming") {
                  normalizedState = {
                    status: "streaming",
                    input: typeof toolState.input === "string" ? toolState.input : "",
                  }
                } else {
                  let toolContent = Array.isArray(toolState.content) && toolState.content.length > 0 ? toolState.content : undefined
                  if (!toolContent) {
                    const text = typeof toolState.output === "string" ? toolState.output : (toolState.output !== undefined ? JSON.stringify(toolState.output) : "")
                    toolContent = [{ type: "text", text }]
                  }
                  normalizedState = {
                    status: "completed",
                    input: toolState.input ?? {},
                    content: toolContent,
                    ...(toolState.metadata ? { metadata: toolState.metadata } : {}),
                  }
                }
              }
              content.push({
                type: "tool",
                id: p.data.callID || p.id,
                name: p.data.tool || "unknown",
                state: normalizedState,
                time: {
                  created: p.data.time?.start || p.time_created,
                  ...(p.data.time?.end ? { completed: p.data.time.end } : {}),
                },
              })
            }
          }

          const payload = {
            version: 1,
            agent: msgData.agent || "build",
            model: {
              providerID: msgData.providerID || "ollama-cloud",
              id: msgData.modelID || "whis-default",
              variant: msgData.variant || "default",
            },
            content,
            snapshot:
              startSnapshot || endSnapshot
                ? {
                    ...(startSnapshot ? { start: startSnapshot } : {}),
                    ...(endSnapshot ? { end: endSnapshot } : {}),
                  }
                : undefined,
            cost: msgData.cost ?? 0,
            tokens: msgData.tokens ?? {
              input: 0,
              output: 0,
              reasoning: 0,
              cache: { read: 0, write: 0 },
            },
            finish: msgData.finish || "stop",
            time: {
              created: m.time_created,
              completed: msgData.time?.completed || m.time_updated,
            },
          }

          yield* db.run(sql`
            INSERT INTO session_message (id, session_id, type, seq, time_created, time_updated, data)
            VALUES (${m.id}, ${sessionID}, 'assistant', ${nextSeq++}, ${m.time_created}, ${m.time_updated}, ${JSON.stringify(payload)})
            ON CONFLICT(id) DO NOTHING
          `).pipe(Effect.orDie)
        }
      }

      if (nextSeq > 0) {
        yield* db.run(sql`
          INSERT INTO event_sequence (aggregate_id, seq, owner_id)
          VALUES (${sessionID}, ${nextSeq - 1}, NULL)
          ON CONFLICT(aggregate_id) DO UPDATE SET
            seq = MAX(seq, excluded.seq)
        `).pipe(Effect.orDie)
      }
    }

    // 2. Reconcile missing V2 messages into message / part
    const missingV2 = yield* db.all<{
      id: string
      session_id: string
      type: string
      seq: number
      time_created: number
      time_updated: number
      data: string
    }>(sql`
      SELECT id, session_id, type, seq, time_created, time_updated, data
      FROM session_message
      WHERE session_id = ${sessionID}
        AND (type = 'user' OR type = 'assistant')
        AND id NOT IN (SELECT id FROM message WHERE session_id = ${sessionID})
      ORDER BY seq ASC
    `).pipe(Effect.orDie)

    if (missingV2 && missingV2.length > 0) {
      for (const msgRow of missingV2) {
        const decoded = SchemaDecodeMessageRow(msgRow)
        if (decoded) {
          yield* syncV2MessageToV1(db, sessionID, decoded)
        }
      }
    }
  })
}

function toEpoch(val: unknown, fallback: number = Date.now()): number {
  if (typeof val === "number" && !isNaN(val)) return val
  if (!val) return fallback
  try {
    return DateTime.toEpochMillis(val as any)
  } catch {
    const n = Number(val)
    return isNaN(n) ? fallback : n
  }
}

export function syncV2MessageToV1(db: Database, sessionID: string, message: SessionMessage.Info) {
  return Effect.gen(function* () {
    const timeCreated = toEpoch(message.time?.created)
    const timeUpdated =
      "completed" in message.time && message.time.completed
        ? toEpoch(message.time.completed, timeCreated)
        : timeCreated

    if (message.type === "user") {
      const userMsgData = {
        version: 1,
        role: "user",
        time: { created: timeCreated },
        agent: "build",
        summary: { diffs: [] },
      }

      yield* db.run(sql`
        INSERT INTO message (id, session_id, time_created, time_updated, data)
        VALUES (${message.id}, ${sessionID}, ${timeCreated}, ${timeUpdated}, ${JSON.stringify(userMsgData)})
        ON CONFLICT(id) DO UPDATE SET
          time_updated = excluded.time_updated,
          data = excluded.data
      `).pipe(Effect.orDie)

      const text = message.text ?? ""
      const cleanID = message.id.replace(/^msg_/, "")
      const partID = `prt_${cleanID}`
      const partData = { type: "text", text }

      yield* db.run(sql`
        INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
        VALUES (${partID}, ${message.id}, ${sessionID}, ${timeCreated}, ${timeUpdated}, ${JSON.stringify(partData)})
        ON CONFLICT(id) DO UPDATE SET
          time_updated = excluded.time_updated,
          data = excluded.data
      `).pipe(Effect.orDie)
      return
    }

    if (message.type === "assistant") {
      // Find parentID from previous user message
      const parentRow = yield* db.get<{ id: string }>(sql`
        SELECT id FROM session_message
        WHERE session_id = ${sessionID} AND type = 'user' AND time_created <= ${timeCreated}
        ORDER BY seq DESC LIMIT 1
      `).pipe(Effect.orDie)

      let parentID = parentRow?.id
      if (!parentID) {
        const v1ParentRow = yield* db.get<{ id: string }>(sql`
          SELECT id FROM message
          WHERE session_id = ${sessionID} AND json_extract(data, '$.role') = 'user' AND time_created <= ${timeCreated}
          ORDER BY time_created DESC LIMIT 1
        `).pipe(Effect.orDie)
        parentID = v1ParentRow?.id
      }

      const inputTokens = message.tokens?.input ?? 0
      const outputTokens = message.tokens?.output ?? 0
      const reasoningTokens = message.tokens?.reasoning ?? 0
      const cacheRead = message.tokens?.cache?.read ?? 0
      const cacheWrite = message.tokens?.cache?.write ?? 0

      const assistantMsgData = {
        version: 1,
        ...(parentID ? { parentID } : {}),
        role: "assistant",
        mode: "build",
        agent: message.agent ?? "build",
        modelID: message.model?.id,
        providerID: message.model?.providerID,
        finish: message.finish ?? "stop",
        cost: message.cost ?? 0,
        tokens: {
          total: inputTokens + outputTokens,
          input: inputTokens,
          output: outputTokens,
          reasoning: reasoningTokens,
          cache: { write: cacheWrite, read: cacheRead },
        },
        time: {
          created: timeCreated,
          completed: timeUpdated,
        },
      }

      yield* db.run(sql`
        INSERT INTO message (id, session_id, time_created, time_updated, data)
        VALUES (${message.id}, ${sessionID}, ${timeCreated}, ${timeUpdated}, ${JSON.stringify(assistantMsgData)})
        ON CONFLICT(id) DO UPDATE SET
          time_updated = excluded.time_updated,
          data = excluded.data
      `).pipe(Effect.orDie)

      const cleanID = message.id.replace(/^msg_/, "")

      // 1. step-start part
      const startSnapshot = message.snapshot?.start ?? ""
      const startPartID = `prt_${cleanID}_start`
      const startPartData = { type: "step-start", snapshot: startSnapshot }
      yield* db.run(sql`
        INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
        VALUES (${startPartID}, ${message.id}, ${sessionID}, ${timeCreated}, ${timeCreated}, ${JSON.stringify(startPartData)})
        ON CONFLICT(id) DO UPDATE SET
          time_updated = excluded.time_updated,
          data = excluded.data
      `).pipe(Effect.orDie)

      // 2. content parts
      let index = 0
      for (const item of message.content) {
        let partID = `prt_${cleanID}_${index++}`
        let partData: Record<string, unknown> = { type: item.type }
        if (item.type === "text") {
          partID = `prt_${cleanID}_t_${index}`
          partData = { type: "text", text: item.text }
        } else if (item.type === "reasoning") {
          partID = `prt_${cleanID}_r_${index}`
          partData = {
            type: "reasoning",
            text: item.text,
            time: {
              start: toEpoch(item.time?.created, timeCreated),
              end: toEpoch(item.time?.completed, timeUpdated),
            },
          }
        } else if (item.type === "tool") {
          partID = `prt_${cleanID}_tool_${index}`
          const tState: any = item.state
          let v1State: any = tState
          if (tState && typeof tState === "object") {
            if (tState.status === "completed") {
              const text = Array.isArray(tState.content)
                ? tState.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n")
                : ""
              v1State = {
                status: "completed",
                input: tState.input ?? {},
                output: text,
                time: {
                  start: toEpoch(item.time?.created, timeCreated),
                  end: toEpoch(item.time?.completed, timeUpdated),
                },
                ...(tState.metadata ? { metadata: tState.metadata } : {}),
              }
            } else if (tState.status === "error") {
              v1State = {
                status: "error",
                input: tState.input ?? {},
                error: typeof tState.error === "string" ? tState.error : tState.error?.message || "Tool execution failed",
                time: {
                  start: toEpoch(item.time?.created, timeCreated),
                  end: toEpoch(item.time?.completed, timeUpdated),
                },
                ...(tState.metadata ? { metadata: tState.metadata } : {}),
              }
            }
          }
          partData = {
            type: "tool",
            callID: item.id,
            tool: item.name,
            state: v1State,
            time: {
              start: toEpoch(item.time?.created, timeCreated),
              end: toEpoch(item.time?.completed, timeUpdated),
            },
          }
        }

        yield* db.run(sql`
          INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
          VALUES (${partID}, ${message.id}, ${sessionID}, ${timeCreated}, ${timeUpdated}, ${JSON.stringify(partData)})
          ON CONFLICT(id) DO UPDATE SET
            time_updated = excluded.time_updated,
            data = excluded.data
        `).pipe(Effect.orDie)
      }

      // 3. step-finish part
      const endSnapshot = message.snapshot?.end ?? startSnapshot
      const finishPartID = `prt_${cleanID}_finish`
      const finishPartData = {
        type: "step-finish",
        reason: message.finish ?? "stop",
        snapshot: endSnapshot,
        tokens: assistantMsgData.tokens,
        cost: assistantMsgData.cost,
      }
      yield* db.run(sql`
        INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
        VALUES (${finishPartID}, ${message.id}, ${sessionID}, ${timeCreated}, ${timeUpdated}, ${JSON.stringify(finishPartData)})
        ON CONFLICT(id) DO UPDATE SET
          time_updated = excluded.time_updated,
          data = excluded.data
      `).pipe(Effect.orDie)
    }
  })
}

export function syncAll(db: Database) {
  return Effect.gen(function* () {
    yield* installTriggers(db)
    yield* reconcileSessions(db)

    // Reconcile all sessions with messages that need reconciliation in either direction
    const outOfSyncSessions = yield* db.all<{ id: string }>(sql`
      SELECT DISTINCT session_id AS id FROM message
      WHERE id NOT IN (SELECT id FROM session_message)
      UNION
      SELECT DISTINCT session_id AS id FROM session_message
      WHERE (type = 'user' OR type = 'assistant') AND id NOT IN (SELECT id FROM message)
    `).pipe(Effect.orDie)

    for (const item of outOfSyncSessions) {
      yield* reconcileSessionV1Messages(db, item.id)
    }
  }).pipe(Effect.orDie)
}

function SchemaDecodeMessageRow(row: {
  id: string
  session_id: string
  type: string
  time_created: number
  time_updated: number
  data: unknown
}): SessionMessage.Info | undefined {
  let data: any = {}
  try {
    data = typeof row.data === "string" ? JSON.parse(row.data) : row.data
  } catch {
    data = {}
  }
  return {
    ...data,
    id: row.id,
    type: row.type,
    time: {
      created: row.time_created,
      ...(data && typeof data === "object" && "time" in data && typeof data.time === "object" && data.time
        ? data.time
        : {}),
    },
  } as SessionMessage.Info
}
