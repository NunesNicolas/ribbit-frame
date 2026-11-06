const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { newer, releaseVersion, check, download } = require('../src/updater.cjs');
assert.deepEqual(releaseVersion('v0.1.0-build.17'), [0, 1, 0, 17]);
assert.equal(newer('v0.1.0-build.18', '0.1.0', 17), true);
assert.equal(newer('v0.1.0-build.17', '0.1.0', 17), false);
assert.equal(newer('v0.0.9-build.99', '0.1.0', 17), false);
assert.equal(newer('v0.2.0-build.1', '0.1.0', 17), true);
assert.equal(newer('unrelated-tag', '0.1.0', 17), false);
(async () => {
  const original = global.fetch;
  const bytes = Buffer.from('test installer');
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  const url = 'https://github.com/NunesNicolas/ribbit-frame/releases/download/v0.1.0-build.18/Ribbit-Frame-Setup-0.1.0.exe';
  const release = { tag_name: 'v0.1.0-build.18', html_url: 'https://github.com/NunesNicolas/ribbit-frame/releases/tag/v0.1.0-build.18', assets: [{ name: 'Ribbit-Frame-Setup-0.1.0.exe', browser_download_url: url, digest: 'sha256:' + digest, size: bytes.length }] };
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ribbit-update-test-'));
  try {
    global.fetch = async target => String(target).includes('/releases/latest') ? new Response(JSON.stringify(release), { status: 200 }) : target === url ? new Response(null, { status: 302, headers: { location: 'https://cdn.example.com/installer' } }) : new Response(bytes);
    const update = await check('0.1.0', 17);
    assert.equal(update.tag, release.tag_name);
    const progress = [];
    const file = await download(update, dir, value => progress.push(value));
    assert.deepEqual(await fs.readFile(file), bytes);
    assert.deepEqual(progress, [100]);
    release.assets[0].digest = 'sha256:' + '0'.repeat(64);
    await assert.rejects(download({ ...update, sha256: '0'.repeat(64) }, dir, () => {}), /SHA-256/);
  } finally { global.fetch = original; await fs.rm(dir, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
