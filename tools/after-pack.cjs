'use strict';
const fs = require('fs');
const path = require('path');

exports.default = async function (context) {
  if (context.electronPlatformName !== 'win32') return;

  let resedit;
  try {
    resedit = require('resedit');
  } catch {
    console.log('[afterPack] resedit not installed, skipping icon patch.');
    return;
  }

  const ROOT = path.resolve(__dirname, '..');
  const icoPath = path.join(ROOT, 'build', 'icon.ico');
  const exePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);

  if (!fs.existsSync(icoPath) || !fs.existsSync(exePath)) return;

  try {
    console.log(`[afterPack] Patching PE icon on ${exePath}...`);
    const icoData = fs.readFileSync(icoPath);
    const iconFile = resedit.Data.IconFile.from(icoData);
    const icons = iconFile.icons.map((item) => item.data);

    const exeData = fs.readFileSync(exePath);
    const exe = resedit.NtExecutable.from(exeData);
    const res = resedit.NtExecutableResource.from(exe);

    resedit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, 0, icons);
    res.outputResource(exe);
    const newBuf = Buffer.from(exe.generate());
    fs.writeFileSync(exePath, newBuf);
    console.log(`[afterPack] Successfully patched icon in ${exePath}`);
  } catch (err) {
    console.warn('[afterPack] Failed to patch icon:', err.message);
  }
};
