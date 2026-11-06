const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const releaseApi = 'https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/latest';
const permitted = new Set(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']);
function run(file, args, cwd) {
  return new Promise((resolve, reject) => {
    const process = spawn(file, args, { cwd, windowsHide: true });
    let error = '';
    process.stderr.on('data', chunk => error = (error + chunk).slice(-1000));
    process.on('error', reject);
    process.on('close', code => code === 0 ? resolve() : reject(new Error(error || 'Falha ao extrair FFmpeg.')));
  });
}
async function downloadAsset(url, file) {
  for (let i = 0; i < 5; i++) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !permitted.has(parsed.hostname)) throw new Error('Redirecionamento do FFmpeg não permitido.');
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(120000), headers: { 'User-Agent': 'Ribbit Frame' } });
    if (response.status >= 300 && response.status < 400) { url = new URL(response.headers.get('location'), url).href; continue; }
    if (!response.ok) throw new Error(`Download do FFmpeg: HTTP ${response.status}.`);
    const output = await fs.open(file, 'w');
    const hash = crypto.createHash('sha256');
    let size = 0;
    try {
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 250000000) throw new Error('FFmpeg excede o limite de tamanho.');
        hash.update(chunk);
        await output.write(chunk);
      }
    } finally { await output.close(); }
    return hash.digest('hex');
  }
  throw new Error('Redirecionamentos demais ao obter FFmpeg.');
}
async function locate(directory) {
  if (process.platform !== 'win32') throw new Error('FFmpeg integrado disponível no Windows.');
  const root = path.join(directory, 'ffmpeg');
  const marker = path.join(root, 'ffmpeg.exe');
  try { await fs.access(marker); return root; } catch {}
  const response = await fetch(releaseApi, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'Ribbit Frame', Accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error(`Consulta do FFmpeg: HTTP ${response.status}.`);
  const release = await response.json();
  const asset = release.assets?.find(item => /^ffmpeg-master-latest-win64-gpl\.zip$/.test(item.name));
  if (!asset || !/^sha256:[a-f0-9]{64}$/i.test(asset.digest || '')) throw new Error('Release do FFmpeg sem checksum SHA-256 verificável.');
  await fs.mkdir(directory, { recursive: true });
  const temporary = path.join(directory, `ffmpeg-${crypto.randomUUID()}`);
  await fs.mkdir(temporary);
  try {
    const archive = path.join(temporary, 'ffmpeg.zip');
    const digest = await downloadAsset(asset.browser_download_url, archive);
    if (digest !== asset.digest.slice(7).toLowerCase()) throw new Error('Checksum SHA-256 do FFmpeg inválido.');
    await run('tar.exe', ['-xf', archive, '-C', temporary]);
    const folder = (await fs.readdir(temporary, { withFileTypes: true })).find(item => item.isDirectory());
    if (!folder) throw new Error('Pacote FFmpeg sem diretório bin.');
    const bin = path.join(temporary, folder.name, 'bin');
    await fs.access(path.join(bin, 'ffmpeg.exe'));
    await fs.mkdir(root, { recursive: true });
    await fs.copyFile(path.join(bin, 'ffmpeg.exe'), marker);
    await fs.copyFile(path.join(bin, 'ffprobe.exe'), path.join(root, 'ffprobe.exe'));
    return root;
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}
module.exports = { locate };
