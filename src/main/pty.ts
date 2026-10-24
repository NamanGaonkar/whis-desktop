import { WebContents } from 'electron';
import { hardKillTree } from './procKill';
import { resolveUserEnv } from './shellEnv';
import { injectProviderEnv } from './providers';
import { PtySpawnOptions } from '../shared/types';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

let nodePty: any = null;
try {
  nodePty = require('node-pty');
} catch (e) {
  console.warn('[PTY] node-pty native module could not be loaded directly:', e);
}

interface PtySession {
  id: string;
  proc: any;
  sender: WebContents;
}

const sessions = new Map<string, PtySession>();

function findWhisExecutable(): string {
  // Check common locations
  if (process.platform === 'win32') {
    const userProfile = process.env.USERPROFILE || '';
    const goWhis = join(userProfile, 'go', 'bin', 'whis.exe');
    if (existsSync(goWhis)) return goWhis;

    const npmWhis = join(userProfile, 'AppData', 'Roaming', 'npm', 'whis.cmd');
    if (existsSync(npmWhis)) return npmWhis;
  }
  return 'whis';
}

export function spawnAgentPty(
  options: PtySpawnOptions,
  sender: WebContents
): { success: boolean; pid?: number; error?: string } {
  const { id, command, args = [], cwd = process.cwd(), cols = 120, rows = 30 } = options;

  // Kill existing session with same ID if present
  killAgentPty(id);

  const env = resolveUserEnv();
  injectProviderEnv(env);

  let targetCommand = command;
  if (!targetCommand || targetCommand === 'whis') {
    targetCommand = findWhisExecutable();
  }

  try {
    if (nodePty) {
      const proc = nodePty.spawn(targetCommand, args, {
        name: 'xterm-256color',
        cols: Math.max(cols, 20),
        rows: Math.max(rows, 10),
        cwd,
        env,
        useConpty: process.platform === 'win32'
      });

      const session: PtySession = { id, proc, sender };
      sessions.set(id, session);

      proc.onData((data: string) => {
        if (!sender.isDestroyed()) {
          sender.send(`pty:data:${id}`, data);
        }
      });

      proc.onExit(({ exitCode, signal }: { exitCode?: number; signal?: number }) => {
        sessions.delete(id);
        if (!sender.isDestroyed()) {
          sender.send(`pty:exit:${id}`, { exitCode, signal });
        }
      });

      return { success: true, pid: proc.pid };
    } else {
      // Fallback using child_process spawn
      const { spawn } = require('node:child_process');
      const proc = spawn(targetCommand, args, {
        cwd,
        env,
        shell: true
      });

      const session: PtySession = { id, proc, sender };
      sessions.set(id, session);

      proc.stdout?.on('data', (data: Buffer) => {
        if (!sender.isDestroyed()) {
          sender.send(`pty:data:${id}`, data.toString('utf-8'));
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        if (!sender.isDestroyed()) {
          sender.send(`pty:data:${id}`, data.toString('utf-8'));
        }
      });

      proc.on('close', (code: number, signal: string) => {
        sessions.delete(id);
        if (!sender.isDestroyed()) {
          sender.send(`pty:exit:${id}`, { exitCode: code, signal: signal ? 1 : 0 });
        }
      });

      return { success: true, pid: proc.pid };
    }
  } catch (err: any) {
    console.error(`[PTY] Failed to spawn ${targetCommand}:`, err);
    return { success: false, error: err?.message || String(err) };
  }
}

export function writeAgentPty(id: string, data: string): void {
  const session = sessions.get(id);
  if (!session) return;
  if (session.proc.write) {
    session.proc.write(data);
  } else if (session.proc.stdin && session.proc.stdin.writable) {
    session.proc.stdin.write(data);
  }
}

export function resizeAgentPty(id: string, cols: number, rows: number): void {
  const session = sessions.get(id);
  if (session && session.proc.resize && cols > 0 && rows > 0) {
    try {
      session.proc.resize(cols, rows);
    } catch {
      // Ignore resize errors on closing sessions
    }
  }
}

export function killAgentPty(id: string): void {
  const session = sessions.get(id);
  if (session) {
    const pid = session.proc.pid;
    sessions.delete(id);
    if (pid) {
      hardKillTree(pid);
    }
  }
}

export function killAllPtys(): void {
  for (const id of Array.from(sessions.keys())) {
    killAgentPty(id);
  }
}
