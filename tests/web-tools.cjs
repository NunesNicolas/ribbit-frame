const assert = require('node:assert/strict');
const { formatOptions, progressFromLine } = require('../src/web-tools.cjs');
const options = formatOptions({ formats: [
  { format_id: '137', ext: 'mp4', vcodec: 'avc1', acodec: 'none', height: 1080, fps: 30 },
  { format_id: '140', ext: 'm4a', vcodec: 'none', acodec: 'mp4a', abr: 128 },
  { format_id: '18', ext: 'mp4', vcodec: 'avc1', acodec: 'mp4a', height: 360, fps: 30 },
] });
assert.equal(options[0].id, '137+140');
assert.equal(options[0].merged, true);
assert.equal(options[1].id, '18');
assert.deepEqual(options.slice(-3).map(option => option.id), ['audio:mp3', 'audio:m4a', 'audio:wav']);

assert.equal(progressFromLine('[download]  42.3% of 10MiB at 2MiB/s').percent, 42.3);
assert.equal(progressFromLine('[Merger] Merging formats').phase, 'processing');
