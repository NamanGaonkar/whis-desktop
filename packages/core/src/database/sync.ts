export * as DatabaseSync from "./sync.js"

import { eq, sql } from "drizzle-orm"
import { Effect } from "effect"
import { SessionMessageTable, SessionTable } from "../session/sql.js"
import { SessionMessage } from "../session/message.js"
import { SessionSchema } from "../session/schema.js"
import { EventSequenceTable } from "../event/sql.js"
import { V1Migration } from "./v1-migration.js"
import type { EffectDrizzleSqlite } from "./drizzle.js"

type Database = EffectDrizzleSqlite.EffectSQLiteDatabase

export function installTriggers(db: Database) {
  return Effect.gen(function* () {
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
          title = NEW.title,
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
  })
}

export function reconcileSessions(db: Database) {
  return Effect.gen(function* () {
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
    const v1Count = yield* db.get<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM message WHERE session_id = ${sessionID}`,
    ).pipe(Effect.orDie)
    if (!v1Count || v1Count.count === 0) return

    const v2Count = yield* db.get<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM session_message WHERE session_id = ${sessionID}`,
    ).pipe(Effect.orDie)

    if (v2Count && v2Count.count >= v1Count.count) return

    const sessionRow = yield* db
      .select()
      .from(SessionTable)
      .where(eq(SessionTable.id, SessionSchema.ID.make(sessionID)))
      .get()
      .pipe(Effect.orDie)
    if (!sessionRow) return

    const sourceMessages = yield* db.all<V1Migration.SourceMessage>(
      sql`SELECT id, session_id, time_created, time_updated, data FROM message WHERE session_id = ${sessionID} ORDER BY time_created ASC`,
    ).pipe(Effect.orDie)

    const sourceParts = yield* db.all<V1Migration.SourcePart>(
      sql`SELECT id, message_id, session_id, time_created, time_updated, data FROM part WHERE session_id = ${sessionID} ORDER BY time_created ASC`,
    ).pipe(Effect.orDie)

    const transformed = V1Migration.transformSession({
      session: sessionRow,
      messages: sourceMessages,
      parts: sourceParts,
    })

    yield* db.transaction((tx) =>
      Effect.gen(function* () {
        for (const message of transformed.messages) {
          yield* tx
            .insert(SessionMessageTable)
            .values({
              id: SessionMessage.ID.make(message.id),
              session_id: SessionSchema.ID.make(message.session_id),
              type: message.type,
              seq: message.seq,
              time_created: message.time_created,
              time_updated: message.time_updated,
              data: sql`${JSON.stringify(message.data)}`,
            })
            .onConflictDoNothing()
        }

        yield* tx
          .insert(EventSequenceTable)
          .values({ aggregate_id: sessionRow.id, seq: transformed.watermark })
          .onConflictDoUpdate({
            target: EventSequenceTable.aggregate_id,
            set: { seq: transformed.watermark, owner_id: null },
          })
      }),
    ).pipe(Effect.orDie)
  })
}

export function syncV2MessageToV1(db: Database, sessionID: string, message: SessionMessage.Info) {
  return Effect.gen(function* () {
    const timeCreated =
      typeof message.time.created === "number" ? message.time.created : Number(message.time.created)
    const timeUpdated =
      "completed" in message.time && message.time.completed
        ? Number(message.time.completed)
        : timeCreated

    if (message.type === "user") {
      const userMsgData = {
        role: "user",
        time: { created: timeCreated },
        agent: "build",
        summary: { diffs: [] },
      }

      yield* db.run(sql`
        INSERT INTO message (id, session_id, time_created, time_updated, data)
        VALUES (${message.id}, ${sessionID}, ${timeCreated}, ${timeUpdated}, ${JSON.stringify(userMsgData)})
        ON CONFLICT(id) DO UPDATE SET
          time_updated = ${timeUpdated},
          data = ${JSON.stringify(userMsgData)}
      `).pipe(Effect.orDie)

      const text = message.text ?? ""
      const partID = `prt_${message.id.replace(/^msg_/, "")}`
      const partData = { type: "text", text }

      yield* db.run(sql`
        INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
        VALUES (${partID}, ${message.id}, ${sessionID}, ${timeCreated}, ${timeUpdated}, ${JSON.stringify(partData)})
        ON CONFLICT(id) DO UPDATE SET
          time_updated = ${timeUpdated},
          data = ${JSON.stringify(partData)}
      `).pipe(Effect.orDie)
      return
    }

    if (message.type === "assistant") {
      const assistantMsgData = {
        role: "assistant",
        agent: message.agent ?? "build",
        modelID: message.model?.id,
        providerID: message.model?.providerID,
        finish: message.finish ?? "stop",
        cost: message.cost ?? 0,
        tokens: message.tokens ?? {
          total: 0,
          input: 0,
          output: 0,
          reasoning: 0,
          cache: { write: 0, read: 0 },
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
          time_updated = ${timeUpdated},
          data = ${JSON.stringify(assistantMsgData)}
      `).pipe(Effect.orDie)

      let index = 0
      for (const item of message.content) {
        const partID = `prt_${message.id.replace(/^msg_/, "")}_${index++}`
        let partData: Record<string, unknown> = { type: item.type }
        if (item.type === "text") {
          partData = { type: "text", text: item.text }
        } else if (item.type === "reasoning") {
          partData = { type: "reasoning", text: item.text }
        } else if (item.type === "tool") {
          partData = { type: "tool", callID: item.id, tool: item.name, state: item.state }
        }

        yield* db.run(sql`
          INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
          VALUES (${partID}, ${message.id}, ${sessionID}, ${timeCreated}, ${timeUpdated}, ${JSON.stringify(partData)})
          ON CONFLICT(id) DO UPDATE SET
            time_updated = ${timeUpdated},
            data = ${JSON.stringify(partData)}
        `).pipe(Effect.orDie)
      }
    }
  })
}

export function syncAll(db: Database) {
  return Effect.gen(function* () {
    yield* installTriggers(db)
    yield* reconcileSessions(db)

    // Reconcile existing CLI sessions into session_message
    const v1Sessions = yield* db.all<{ id: string }>(sql`
      SELECT DISTINCT session_id AS id FROM message
      WHERE session_id NOT IN (SELECT DISTINCT session_id FROM session_message)
    `).pipe(Effect.orDie)

    for (const item of v1Sessions) {
      yield* reconcileSessionV1Messages(db, item.id)
    }

    // Reconcile existing Desktop sessions into message/part
    const v2Sessions = yield* db.all<{ id: string }>(sql`
      SELECT DISTINCT session_id AS id FROM session_message
      WHERE session_id NOT IN (SELECT DISTINCT session_id FROM message)
    `).pipe(Effect.orDie)

    for (const item of v2Sessions) {
      const messages = yield* db
        .select()
        .from(SessionMessageTable)
        .where(eq(SessionMessageTable.session_id, SessionSchema.ID.make(item.id)))
        .all()
        .pipe(Effect.orDie)

      for (const msgRow of messages) {
        const decoded = SchemaDecodeMessageRow(msgRow)
        if (decoded) {
          yield* syncV2MessageToV1(db, item.id, decoded)
        }
      }
    }
  })
}

function SchemaDecodeMessageRow(row: typeof SessionMessageTable.$inferSelect): SessionMessage.Info | undefined {
  const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data
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
