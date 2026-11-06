const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const repo = 'NunesNicolas/ribbit-frame';
const api = `https://api.github.com/repos/${repo}/releases/latest`;
const headers = { 'User-Agent': 'Ribbit Frame', Accept: 'application/vnd.github+json' };
function releaseVersion(tag) {
  const match = /^v(\d+)\.(\d+)\.(\d+)-build\.(\d+)$/.exec(tag || '');
  return match && [...match.slice(1).map(Number)];
}
function newer(tag, currentVersion, currentBuild) {
  const remote = releaseVersion(tag);
  const local = releaseVersion(`v${currentVersion}-build.${currentBuild}`);
  if (!remote || !local) return false;
  for (let i = 0; i < remote.length; i++) {
    if (remote[i] !== local[i]) return remote[i] > local[i];
  }
  return false;
}
async function check(currentVersion, currentBuild) {
  const response = await fetch(api, { headers, signal: AbortSignal.timeout(15000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Consulta de atualização: HTTP ${response.status}.`);
  const release = await response.json();
  if (!newer(release.tag_name, currentVersion, currentBuild)) return null;
  const name = `Ribbit-Frame-Setup-${releaseVersion(release.tag_name).slice(0, 3).join('.')}.exe`;
  const installer = release.assets?.find(asset => asset.name === name);
  if (!installer || !/^sha256:[a-f0-9]{64}$/i.test(installer.digest || '') || installer.size <= 0 || installer.size > 300000000) throw new Error('Release sem instalador verificável.');
  if (installer.browser_download_url !== `https://github.com/${repo}/releases/download/${release.tag_name}/${name}`) throw new Error('Endereço da atualização inválido.');
  return { tag: release.tag_name, name, size: installer.size, url: installer.browser_download_url, sha256: installer.digest.slice(7).toLowerCase(), page: release.html_url };
}
async function download(update, root, progress) {
  await fs.mkdir(root, { recursive: true });
  const target = path.join(root, update.name);
  const temporary = target + '.part';
  try {
    const existing = crypto.createHash('sha256');
    for await (const chunk of fsSync.createReadStream(target)) existing.update(chunk);
    if (existing.digest('hex') === update.sha256) return target;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.rm(target, { force: true });
  let url = update.url;
  try {
    for (let redirects = 0; redirects < 8; redirects++) {
      const address = new URL(url);
      if (address.protocol !== 'https:' || address.username || address.password || (redirects === 0 && address.hostname !== 'github.com')) throw new Error('Origem da atualização inválida.');
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(600000), headers: { 'User-Agent': 'Ribbit Frame' } });
      if (response.status >= 300 && response.status < 400) { url = new URL(response.headers.get('location'), url).href; continue; }
      if (!response.ok) throw new Error(`Download da atualização: HTTP ${response.status}.`);
      const file = await fs.open(temporary, 'w');
      const hash = crypto.createHash('sha256');
      let size = 0;
      try {
        for await (const chunk of response.body) {
          size += chunk.length;
          if (size > 300000000) throw new Error('Atualização excede 300 MB.');
          hash.update(chunk); await file.write(chunk);
          progress(Math.min(100, Math.round(size / update.size * 100)));
        }
      } finally { await file.close(); }
      if (hash.digest('hex') !== update.sha256) throw new Error('Verificação SHA-256 da atualização falhou.');
      await fs.rename(temporary, target);
      return target;
    }
    throw new Error('Redirecionamentos demais ao baixar atualização.');
  } finally { await fs.rm(temporary, { force: true }); }
}
module.exports = { check, download, newer, releaseVersion };

