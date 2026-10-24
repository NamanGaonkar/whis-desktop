import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function getShellExecutable(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe';
  }
  return process.env.SHELL || '/bin/zsh';
}

export function resolveUserEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>;

  // Append common CLI install paths if missing
  if (process.platform === 'win32') {
    const userProfile = process.env.USERPROFILE || '';
    const extraPaths = [
      join(userProfile, 'go', 'bin'),
      join(userProfile, 'AppData', 'Roaming', 'npm'),
      join(userProfile, '.cargo', 'bin'),
      join(userProfile, 'AppData', 'Local', 'Programs', 'Python', 'Scripts'),
      join(userProfile, 'scoop', 'shims'),
      join(userProfile, '.bun', 'bin')
    ];
    const validExtras = extraPaths.filter(p => {
      try {
        return existsSync(p);
      } catch {
        return false;
      }
    });
    if (validExtras.length > 0) {
      env.PATH = `${env.PATH || ''};${validExtras.join(';')}`;
    }
  } else {
    // macOS/Linux: ask login shell for full PATH
    try {
      const shell = getShellExecutable();
      const stdout = execSync(`${shell} -l -c 'echo -n "$PATH"'`, { encoding: 'utf-8', timeout: 3000 });
      if (stdout) env.PATH = stdout;
    } catch {
      env.PATH = `${env.PATH || ''}:/usr/local/bin:/opt/homebrew/bin:~/.cargo/bin:~/.bun/bin`;
    }
  }

  // Force terminal color support
  env.COLORTERM = 'truecolor';
  env.TERM = 'xterm-256color';
  env.FORCE_COLOR = '1';
  return env;
}
