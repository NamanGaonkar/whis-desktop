import { app, BrowserWindow, shell } from 'electron';

export interface UpdateInfo {
  version: string;
  name: string;
  notes: string;
  url: string;
  publishedAt: string;
}

export async function checkGitHubUpdate(window?: BrowserWindow | null): Promise<UpdateInfo | null> {
  try {
    const currentVersion = app.getVersion();
    const res = await fetch('https://api.github.com/repos/NamanGaonkar/whis-desktop/releases/latest', {
      headers: {
        'User-Agent': `Whis-Desktop/${currentVersion}`,
        Accept: 'application/vnd.github.v3+json'
      },
      signal: AbortSignal.timeout(6000)
    });

    if (!res.ok) {
      return null;
    }

    const data: any = await res.json();
    const latestTag = (data.tag_name || '').replace(/^v/, '');
    const currentClean = currentVersion.replace(/^v/, '');

    // Compare versions
    if (latestTag && isNewerVersion(latestTag, currentClean)) {
      const info: UpdateInfo = {
        version: data.tag_name,
        name: data.name || data.tag_name,
        notes: data.body || '',
        url: data.html_url || 'https://github.com/NamanGaonkar/whis-desktop/releases',
        publishedAt: data.published_at
      };

      if (window && !window.isDestroyed()) {
        window.webContents.send('updater:available', info);
      }
      return info;
    }

    return null;
  } catch (err) {
    // Network unavailable or offline, fail gracefully
    return null;
  }
}

function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string) => v.split('.').map((p) => parseInt(p, 10) || 0);
  const [lMaj, lMin, lPat] = parse(latest);
  const [cMaj, cMin, cPat] = parse(current);

  if (lMaj > cMaj) return true;
  if (lMaj === cMaj && lMin > cMin) return true;
  if (lMaj === cMaj && lMin === cMin && lPat > cPat) return true;
  return false;
}
