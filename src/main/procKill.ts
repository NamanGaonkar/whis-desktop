import { execSync } from 'node:child_process';

/**
 * Hard-kills an entire process tree recursively to prevent orphaned zombie CLI subprocesses.
 */
export function hardKillTree(pid: number): void {
  if (!pid || pid <= 0) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    } else {
      execSync(`pkill -TERM -P ${pid} || true; kill -9 ${pid} || true`, {
        shell: '/bin/sh',
        stdio: 'ignore'
      });
    }
  } catch {
    // Process already exited or permission denied
  }
}
