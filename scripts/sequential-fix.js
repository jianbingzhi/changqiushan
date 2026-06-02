// 串行修复:每页发 prompt → 等 Stitch(高度稳定 or fork 出现) → 截图 → 下一页
// 用法: node scripts/sequential-fix.js <queue.json>
//   queue.json: [{code, dataId, label, promptFile, outPath}, ...]
const { sendPrompt, sleep, getCompanionId, rpc, CDP_HOST } = require('./lib.js');
const { findPageByLabel } = require('./find-page.js');
const { zoomShot } = require('./zoom-shot.js');
const WebSocket = require('ws');
const fs = require('fs');

async function getHeight(ws, dataId) {
  const r = await rpc(ws, 1, 'Runtime.evaluate', { expression: `(function(){var n=document.querySelector('[data-id="${dataId}"]');return n?n.style.height:'';})()` });
  return r.result?.result?.value || '';
}

async function waitStitchAndPick(originalId, label, maxSec) {
  const compId = await getCompanionId();
  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + compId);
  await new Promise(r => ws.on('open', r));
  try {
    const known = (await findPageByLabel(label)).filter(n => n.type === 'device');
    const knownIds = new Set(known.map(n => n.dataId));
    let lastH = await getHeight(ws, originalId);
    const startH = lastH;
    let stable = 0;
    let everChanged = false;
    const STABLE = 4; // 4 × 5s = 20s no change

    console.log(`  baseline h=${lastH}, known=${knownIds.size}`);
    const t0 = Date.now();
    while ((Date.now() - t0) / 1000 < maxSec) {
      await sleep(5000);
      const el = Math.round((Date.now() - t0)/1000);

      // 检查新 fork
      const nodes = (await findPageByLabel(label)).filter(n => n.type === 'device');
      const fork = nodes.find(n => !knownIds.has(n.dataId));
      if (fork) { console.log(`  [t=${el}s] FORK: ${fork.dataId.slice(0,8)}`); return fork.dataId; }

      // 检查 in-place height
      const h = await getHeight(ws, originalId);
      if (h !== lastH) {
        console.log(`  [t=${el}s] h ${lastH} → ${h}`);
        lastH = h; stable = 0; everChanged = true;
      } else {
        stable++;
        if (everChanged && stable >= STABLE) {
          console.log(`  [t=${el}s] STABLE in-place; using ${originalId.slice(0,8)}`);
          return originalId;
        }
      }
    }
    console.log(`  [t=${maxSec}s] TIMEOUT — using ${originalId.slice(0,8)}`);
    return originalId;
  } finally { ws.close(); }
}

async function main() {
  const queueFile = process.argv[2];
  if (!queueFile) { console.error('usage: node sequential-fix.js <queue.json>'); process.exit(1); }
  const queue = JSON.parse(fs.readFileSync(queueFile, 'utf-8'));
  const results = [];

  for (let i = 0; i < queue.length; i++) {
    const { code, dataId, label, promptFile, outPath } = queue[i];
    console.log(`\n=== [${i+1}/${queue.length}] ${code} ===`);
    console.log(`  prompt: ${promptFile}`);
    try {
      await sendPrompt(promptFile);
    } catch (e) {
      console.log(`  send err: ${e.message}`);
      results.push({ code, status: 'send-fail', err: e.message });
      continue;
    }
    // Wait
    const finalId = await waitStitchAndPick(dataId, label, 420); // 7 min
    // Capture
    console.log(`  capturing → ${outPath}`);
    const cap = await zoomShot(finalId, outPath);
    console.log(`  ${cap.ok ? '✓ ' + cap.bytes + 'B' : '✗ ' + JSON.stringify(cap)}`);
    results.push({ code, finalId, outPath, ok: cap.ok });
    // Small gap between submits
    await sleep(3000);
  }

  console.log('\n=== ALL DONE ===');
  results.forEach(r => console.log(`  ${r.code}: ${r.ok?'✓':'✗'} ${r.finalId?.slice(0,8)}`));
  fs.writeFileSync('/tmp/seq-fix-results.json', JSON.stringify(results, null, 2));
}

if (require.main === module) main().catch(e => { console.error('FATAL:', e); process.exit(1); });
