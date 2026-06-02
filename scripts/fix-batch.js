// 用 narrow chrome-fix 模板批量修每个页面
// 用法: node scripts/fix-batch.js <queue.json>
//   queue.json: [{page,active,group,label}, ...]
//   page: Stitch 页面中文标签(用于 wait-fork 匹配)
//   active: 侧边栏激活项中文名
//   group: 面包屑一级分组
//   label: Stitch prompt 里用的页面引用名(通常与 page 相同)
const { sendPrompt, sleep } = require('./lib.js');
const { findPageByLabel } = require('./find-page.js');
const fs = require('fs');
const path = require('path');

async function findFork(label, beforeIds, maxSec) {
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < maxSec) {
    await sleep(15000);
    const now = await findPageByLabel(label);
    const newOnes = now.filter(n => n.type === 'device' && !beforeIds.has(n.dataId));
    if (newOnes.length > 0) {
      // Prefer one with "修正版" / "1440" in name
      const fixed = newOnes.find(n => /修正版|1440|v2/i.test(n.label)) || newOnes[newOnes.length - 1];
      return fixed.dataId;
    }
  }
  return null;
}

async function main() {
  const queueFile = process.argv[2];
  if (!queueFile) { console.error('usage: node scripts/fix-batch.js <queue.json>'); process.exit(1); }
  const queue = JSON.parse(fs.readFileSync(queueFile, 'utf-8'));
  const template = fs.readFileSync('prompts/fix-narrow-template.txt', 'utf-8');
  const results = [];

  for (let i = 0; i < queue.length; i++) {
    const { page, active, group, label, code } = queue[i];
    console.log(`\n=== [${i+1}/${queue.length}] ${code} | ${page} ===`);

    // Generate per-page prompt
    const prompt = template
      .replace(/{PAGE_NAME}/g, page)
      .replace(/{ACTIVE_ITEM}/g, active)
      .replace(/{GROUP_NAME}/g, group);
    const promptFile = `/tmp/fix-${code}.txt`;
    fs.writeFileSync(promptFile, prompt);

    // Snapshot baseline
    const before = (await findPageByLabel(label || page)).filter(n => n.type === 'device');
    const beforeIds = new Set(before.map(n => n.dataId));
    console.log(`baseline: ${beforeIds.size} nodes`);

    // Send
    try {
      await sendPrompt(promptFile);
    } catch (e) { console.log('send error:', e.message); results.push({ code, status: 'send-fail' }); continue; }

    // Wait for new fork (3 min max)
    const newId = await findFork(label || page, beforeIds, 180);
    if (newId) {
      console.log(`  ✓ new fork: ${newId}`);
      results.push({ code, page, dataId: newId, status: 'ok' });
    } else {
      // Maybe in-place edit — pick the canonical from baseline + check height change
      console.log(`  ⚠ no fork; using existing canonical`);
      results.push({ code, page, dataId: Array.from(beforeIds)[0] || null, status: 'no-fork' });
    }
  }

  fs.writeFileSync('/tmp/fix-results.json', JSON.stringify(results, null, 2));
  console.log('\n=== DONE ===');
  console.log(JSON.stringify(results, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
