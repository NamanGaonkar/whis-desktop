'use strict';
const { spawnSync } = require('child_process');

const env = { ...process.env };

// Strip empty signing / notarization env vars so unsigned builds succeed cleanly
const signingKeys = [
  'CSC_LINK',
  'CSC_KEY_PASSWORD',
  'CSC_INSTALLER_LINK',
  'CSC_INSTALLER_KEY_PASSWORD',
  'APPLE_ID',
  'APPLE_APP_SPECIFIC_PASSWORD',
  'APPLE_TEAM_ID',
  'APPLE_API_KEY',
  'APPLE_API_KEY_ID',
  'APPLE_API_ISSUER',
  'WIN_CSC_LINK',
  'WIN_CSC_KEY_PASSWORD'
];

for (const key of signingKeys) {
  if (env[key] !== undefined && !env[key].trim()) {
    delete env[key];
  }
}

// When building without credentials in CI, disable auto-discovery to prevent keychain queries
if (!env.CSC_LINK && process.platform === 'darwin') {
  env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
}

const args = process.argv.slice(2);
const cliPath = require.resolve('electron-builder/cli.js');

const res = spawnSync(process.execPath, [cliPath, ...args, '--publish', 'never'], {
  stdio: 'inherit',
  env
});

if (res.error) {
  console.error(res.error);
  process.exit(1);
}

process.exit(res.status ?? 0);
