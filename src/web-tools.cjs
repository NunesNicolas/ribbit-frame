const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const dns = require('node:dns/promises');
const net = require('node:net');
const { spawn } = require('node:child_process');
const ffmpeg = require('./ffmpeg.cjs');

const version = 'latest';
const release = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/';
const githubHosts = ['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'];
function safeUrl(value, hosts) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || !hosts.includes(url.hostname)) throw new Error('Endereço não permitido.');
  return url.href;
}
function isPrivateAddress(address) {
  if (net.isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const value = address.toLowerCase();
  return value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:') || value.startsWith('::ffff:');
}
async function requirePublicHost(hostname) {
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || net.isIP(hostname)) throw new Error('Endereço de imagem não permitido.');
  const addresses = await dns.lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(item => isPrivateAddress(item.address))) throw new Error('Endereço de imagem não permitido.');
}
async function fetchBytes(url, limit, hosts, publicOnly = false) {
  for (let i = 0; i < 4; i++) {
    safeUrl(url, hosts);
    if (publicOnly) await requirePublicHost(new URL(url).hostname);
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
    if (response.status >= 300 && response.status < 400) { url = new URL(response.headers.get('location'), url).href; continue; }
    if (!response.ok) throw new Error(`Servidor respondeu HTTP ${response.status}.`);
    if (Number(response.headers.get('content-length')) > limit) throw new Error('Arquivo muito grande.');
    const chunks = []; let size = 0;
    for await (const chunk of response.body) { size += chunk.length; if (size > limit) throw new Error('Arquivo muito grande.'); chunks.push(chunk); }
    return { data: Buffer.concat(chunks), type: response.headers.get('content-type') || '' };
  }
  throw new Error('Redirecionamentos demais.');
}
async function fetchVerifiedExecutable(url, sumsUrl, checksumPattern, file, hosts) {
  const sums = (await fetchBytes(sumsUrl, 100000, hosts)).data.toString();
  const expected = sums.split(/\r?\n/).find(row => checksumPattern.test(row))?.trim().split(/\s+/)[0]?.toLowerCase();
  if (!expected || !/^[a-f0-9]{64}$/.test(expected)) throw new Error('Checksum da ferramenta auxiliar não encontrado.');
  const temporary = file + '.' + crypto.randomUUID() + '.tmp';
  try {
    for (let i = 0; i < 4; i++) {
      safeUrl(url, hosts);
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(300000) });
      if (response.status >= 300 && response.status < 400) {
        url = new URL(response.headers.get('location'), url).href;
        continue;
      }
      if (!response.ok) throw new Error(`Servidor respondeu HTTP ${response.status}.`);
      const hash = crypto.createHash('sha256');
      const output = await fs.open(temporary, 'wx');
      try {
        for await (const chunk of response.body) {
          hash.update(chunk);
          let offset = 0;
          while (offset < chunk.length) offset += (await output.write(chunk, offset, chunk.length - offset)).bytesWritten;
        }
      } finally { await output.close(); }
      if (hash.digest('hex') !== expected) throw new Error('Verificação SHA-256 da ferramenta auxiliar falhou.');
      await fs.rename(temporary, file);
      return file;
    }
    throw new Error('Redirecionamentos demais.');
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}
async function executable(directory) {
  if (process.platform !== 'win32') throw new Error('O downloader integrado está disponível no Windows.');
  const file = path.join(directory, `yt-dlp-${version}.exe`);
  try { await fs.access(file); return file; } catch {}
  await fs.mkdir(directory, { recursive: true });
  return fetchVerifiedExecutable(release + 'yt-dlp.exe', release + 'SHA2-256SUMS', /\s\*?yt-dlp\.exe$/, file, githubHosts);
}
const nodeRelease = 'https://nodejs.org/dist/v22.16.0/';
async function nodeExecutable(directory) {
  const file = path.join(directory, 'node-v22.16.0.exe');
  try { await fs.access(file); return file; } catch {}
  await fs.mkdir(directory, { recursive: true });
  return fetchVerifiedExecutable(nodeRelease + 'win-x64/node.exe', nodeRelease + 'SHASUMS256.txt', /\s+win-x64\/node\.exe$/, file, ['nodejs.org']);
}
function run(exe, args, progress = () => {}, capture = true) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, ['--no-playlist', '--no-config', '--no-update', ...args], { cwd: path.dirname(exe), env: { ...process.env, TEMP: path.dirname(exe), TMP: path.dirname(exe) }, windowsHide: true });
    let output = '', errors = '';
    const timer = capture ? setTimeout(() => child.kill(), 300000) : null;
    child.stdout.on('data', chunk => { if (capture) { output += chunk; if (output.length > 3000000) child.kill(); } progress(String(chunk)); });
    child.stderr.on('data', chunk => { errors = (errors + chunk).slice(-2000); });
    child.on('error', reject);
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(output) : reject(new Error(errors.trim() || 'Falha ou tempo esgotado no yt-dlp.')); });
  });
}
async function formats(url, directory) {
  const info = JSON.parse(await run(await executable(directory), ['--js-runtimes', 'node:' + await nodeExecutable(directory), '--dump-single-json', '--skip-download', safeUrl(url, ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'])]));
  const thumbnail = [info.thumbnail, ...(info.thumbnails || []).map(item => item.url)].reverse().find(value => { try { const url = new URL(value); return url.protocol === 'https:' && (url.hostname === 'i.ytimg.com' || url.hostname === 'img.youtube.com' || /^i[0-9]\.ytimg\.com$/.test(url.hostname)); } catch { return false; } });
  return { title: info.title, thumbnail: thumbnail || null, options: formatOptions(info) };
}
function formatOptions(info) {
  const source = info.formats || [];
  const audio = source.filter(item => item.acodec !== 'none' && item.vcodec === 'none');
  const bestAudio = ext => audio.filter(item => item.ext === ext).sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0))[0];
  const options = source.filter(item => item.vcodec !== 'none' && ['mp4', 'webm'].includes(item.ext)).flatMap(item => {
    const merged = item.acodec === 'none';
    const match = merged ? bestAudio(item.ext === 'mp4' ? 'm4a' : 'webm') : null;
    if (merged && !match) return [];
    return [{ id: merged ? item.format_id + '+' + match.format_id : item.format_id, ext: item.ext, height: item.height || 0, fps: item.fps || 0, merged }];
  }).sort((a, b) => b.height - a.height || b.fps - a.fps);
  if (audio.length) options.push(...['mp3', 'm4a', 'wav'].map(ext => ({ id: 'audio:' + ext, ext, height: 0, fps: 0, audioOnly: true })));
  if (!options.length) throw new Error('Nenhum formato disponível para este link.');
  return options;
}
function progressFromLine(line) {
  const match = line.match(/\[download\]\s+([\d.]+)%/);
  if (match) return { phase: 'downloading', percent: Math.min(100, Number(match[1])), label: line.trim().slice(0, 140) };
  if (/\[(Merger|ExtractAudio|ffmpeg|Fixup)/i.test(line)) return { phase: 'processing', percent: null, label: 'Processando mídia…' };
  return null;
}
async function download(url, formatId, directory, destination, progress) {
  const info = await formats(url, directory);
  const selected = info.options.find(format => format.id === formatId);
  if (!selected) throw new Error('Formato inválido.');
  progress({ phase: 'preparing', percent: null, label: selected.merged || selected.audioOnly ? 'Preparando FFmpeg…' : 'Preparando download…' });
  const ffmpegDirectory = selected.merged || selected.audioOnly ? await ffmpeg.locate(directory) : null;
  await fs.mkdir(destination, { recursive: true });
  const prefix = crypto.randomUUID();
  try {
    const args = ['--js-runtimes', 'node:' + await nodeExecutable(directory), '--no-part', '-f', selected.audioOnly ? 'bestaudio' : formatId, '-o', path.join(destination, prefix + '.%(ext)s'), '--newline'];
    if (ffmpegDirectory) args.push('--ffmpeg-location', ffmpegDirectory);
    if (selected.audioOnly) args.push('-x', '--audio-format', selected.ext);
    else if (selected.merged) args.push('--merge-output-format', selected.ext);
    args.push(safeUrl(url, ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']));
    let pending = '';
    let completedParts = 0;
    const totalParts = selected.merged ? 2 : 1;
    await run(await executable(directory), args, chunk => {
      pending += chunk;
      const lines = pending.split(/\r?\n|\r/); pending = lines.pop() || '';
      for (const line of lines) {
        const event = progressFromLine(line);
        if (event?.phase === 'downloading' && totalParts > 1) {
          const partPercent = event.percent;
          event.percent = Math.round((completedParts + partPercent / 100) * 100 / totalParts);
          event.label = `Arquivo ${Math.min(completedParts + 1, totalParts)} de ${totalParts} · ${event.label}`;
          if (partPercent >= 100 && completedParts < totalParts - 1) completedParts++;
        }
        if (event) progress(event);
      }
    }, false);
    const name = (await fs.readdir(destination)).find(entry => entry.startsWith(prefix + '.') && ['.mp4', '.webm', '.mp3', '.m4a', '.wav'].includes(path.extname(entry)));
    if (!name) throw new Error('Arquivo baixado não encontrado.');
    const safeTitle = String(info.title || 'YouTube').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim().replace(/[. ]+$/, '').slice(0, 110) || 'YouTube';
    const finalName = safeTitle + ' - ' + prefix.slice(0, 8) + path.extname(name);
    const finalPath = path.join(destination, finalName);
    await fs.rename(path.join(destination, name), finalPath);
    return { path: finalPath, name: safeTitle + path.extname(name) };
  } catch (error) {
    for (const entry of await fs.readdir(destination)) if (entry.startsWith(prefix + '.')) await fs.rm(path.join(destination, entry), { force: true });
    throw error;
  }
}

function extractImages(html, source) {
  const decoded = html.replaceAll('\\u002F', '/').replaceAll('\\/', '/').replaceAll('&amp;', '&');
  const pattern = source === 'Pinterest'
    ? /https:\/\/i\.pinimg\.com\/[^\s"'<>\\]+?\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>\\]*)?/gi
    : /https:\/\/[^\s"'<>\\]+?\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>\\]*)?/gi;
  const urls = [...decoded.matchAll(pattern)].map(match => match[0].replaceAll('\\u003d', '=').replaceAll('\\u0026', '&'));
  return [...new Set(urls)].filter(value => {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:') return false;
      if (source === 'Pinterest') return url.hostname === 'i.pinimg.com';
      return !/(google|gstatic|youtube|pinimg)\.com$/.test(url.hostname);
    } catch { return false; }
  }).slice(0, 60);
}
async function searchImages(query) {
  query = String(query || '').trim().slice(0, 120);
  if (query.length < 2) throw new Error('Digite ao menos duas letras.');
  const sources = [
    { source: 'Google Imagens', url: 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(query), host: 'www.google.com' },

  ];
  const results = await Promise.all(sources.map(async ({ source, url, host }) => {
    try {
      const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36', 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' };

      const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw Error('HTTP ' + response.status);
      const html = (await response.text()).slice(0, 6000000);
      return { source, images: extractImages(html, source).map(imageUrl => ({ url: imageUrl, source })) };
    } catch (error) { return { source, images: [], error: error.message }; }
  }));
  return results;
}
async function pinterest(url) {
  const hosts = ['pinterest.com', 'www.pinterest.com', 'br.pinterest.com'];
  const html = (await fetchBytes(safeUrl(url, hosts), 4000000, hosts)).data.toString();
  return extractImages(html, 'Pinterest');
}
async function image(url, destination, allowedHosts = ['i.pinimg.com']) {
  url = safeUrl(url, allowedHosts);
  const extension = path.extname(new URL(url).pathname).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) throw new Error('Formato de imagem inválido.');
  const result = await fetchBytes(url, 25000000, allowedHosts, true);
  if (!result.type.startsWith('image/')) throw new Error('O endereço não retornou uma imagem.');
  await fs.mkdir(destination, { recursive: true });
  const file = path.join(destination, crypto.randomUUID() + extension);
  await fs.writeFile(file, result.data, { flag: 'wx' });
  return file;
}
module.exports = { formats, download, pinterest, searchImages, image, formatOptions, progressFromLine };
