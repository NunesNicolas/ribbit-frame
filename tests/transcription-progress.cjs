const assert = require('node:assert/strict');
const { run } = require('../src/transcription.cjs');
(async () => {
  let seen = '';
  await run(process.execPath, ['-e', 'process.stdout.write(JSON.stringify({ phase: "saved" }) + "\\n")'], {}, chunk => { seen += chunk; });
  assert.equal(JSON.parse(seen.trim()).phase, 'saved');
})().catch(error => { console.error(error); process.exitCode = 1; });
