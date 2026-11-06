const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
let active = null;
let busy = false;
let setupPromise = null;
function run(file, args, options = {}, progress = () => {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true, ...options });
    active = child;
    let output = '';
    child.stdout.on('data', chunk => { output = (output + chunk).slice(-4000); progress(String(chunk)); });
    child.stderr.on('data', chunk => { output = (output + chunk).slice(-4000); });
    child.on('error', reject);
    child.on('close', code => { if (active === child) active = null; code === 0 ? resolve() : reject(new Error(output.trim() || 'Processo de transcrição interrompido.')); });
  });
}
function cancel() { if (!active) return false; active.kill(); return true; }
async function downloadVerified(url, destination, expectedHash) {
  const hosts = new Set(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']);
  for (let attempt = 0; attempt < 5; attempt++) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !hosts.has(parsed.hostname)) throw new Error('Origem de download não permitida.');
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(120000), headers: { 'User-Agent': 'Ribbit Frame' } });
    if (response.status >= 300 && response.status < 400) { url = new URL(response.headers.get('location'), url).href; continue; }
    if (!response.ok) throw new Error(`Download do runtime: HTTP ${response.status}.`);
    const chunks = []; let size = 0;
    for await (const chunk of response.body) { size += chunk.length; if (size > 100000000) throw new Error('Pacote do runtime excede o tamanho esperado.'); chunks.push(chunk); }
    const bytes = Buffer.concat(chunks);
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== expectedHash) throw new Error('Verificação SHA-256 do runtime falhou.');
    await fs.writeFile(destination, bytes, { flag: 'wx' }); return;
  }
  throw new Error('Redirecionamentos demais ao obter o runtime.');
}
async function setup(root, progress) {
  if (process.platform !== 'win32') throw new Error('Transcrição integrada disponível apenas no Windows.');
  const python = path.join(root, 'venv', 'Scripts', 'python.exe');
  try { await fs.access(path.join(root, 'ready')); await fs.access(python); return python; } catch {}
  if (setupPromise) return setupPromise;
  setupPromise = (async () => {
    await fs.mkdir(root, { recursive: true });
    const uv = path.join(root, 'uv.exe');
    try { await fs.access(uv); } catch {
      progress({ phase: 'setup', label: 'Obtendo runtime oficial…' });
      const response = await fetch('https://api.github.com/repos/astral-sh/uv/releases/latest', { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'Ribbit Frame', Accept: 'application/vnd.github+json' } });
      if (!response.ok) throw new Error(`Consulta do runtime: HTTP ${response.status}.`);
      const release = await response.json();
      const asset = release.assets?.find(item => item.name === 'uv-x86_64-pc-windows-msvc.zip');
      if (!asset || !/^sha256:[a-f0-9]{64}$/i.test(asset.digest || '')) throw new Error('Runtime sem checksum SHA-256 verificável.');
      const archive = path.join(root, `uv-${crypto.randomUUID()}.zip`);
      try { await downloadVerified(asset.browser_download_url, archive, asset.digest.slice(7).toLowerCase()); await run('tar.exe', ['-xf', archive, '-C', root]); await fs.access(uv); }
      finally { await fs.rm(archive, { force: true }); }
    }
    const env = { ...process.env, UV_PYTHON_INSTALL_DIR: path.join(root, 'python'), UV_CACHE_DIR: path.join(root, 'cache'), UV_NO_PROGRESS: '1' };
    progress({ phase: 'setup', label: 'Preparando Python local…' });
    await run(uv, ['venv', path.join(root, 'venv'), '--python', '3.11', '--python-preference', 'only-managed'], { env });
    progress({ phase: 'setup', label: 'Preparando Faster-Whisper…' });
    await run(uv, ['pip', 'install', '--python', python, 'faster-whisper==1.2.1'], { env });
    await fs.writeFile(path.join(root, 'ready'), 'faster-whisper==1.2.1');
    return python;
  })();
  try { return await setupPromise; } finally { setupPromise = null; }
}
async function transcribe(root, source, destination, options, progress) {
  if (busy) throw new Error('Já existe uma transcrição em andamento.');
  busy = true;
  try {
    const python = await setup(root, progress);
    const filename = path.parse(source).name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').slice(0, 100) || 'Legenda';
    const output = path.join(destination, `${filename}-${crypto.randomUUID().slice(0, 8)}.${options.format}`);
    const script = path.join(root, 'transcribe.py');
    await fs.copyFile(path.join(__dirname, 'transcribe.py'), script);
    let pending = '', result = null;
    const onChunk = chunk => { pending += chunk; const lines = pending.split(/\r?\n/); pending = lines.pop() || ''; for (const line of lines) { try { const event = JSON.parse(line); if (event.phase === 'saved') result = event; progress(event); } catch {} } };
    await fs.mkdir(destination, { recursive: true });
    try {
      await run(python, ['-u', script, source, output, options.model, options.language, options.format, path.join(root, 'models')], {}, onChunk);
      if (!result) throw new Error('A transcrição terminou sem criar uma legenda.');
      return result;
    } catch (error) { await fs.rm(output, { force: true }); throw error; }
  } finally { busy = false; }
}
module.exports = { transcribe, cancel, run };
