// 监听 Stitch 是否生成了"修正版"新 fork 节点 — 比 progress% 更可靠
//
// 用法: node scripts/wait-fork.js <label> <maxWaitSec>
//   label 是 Stitch 页面中文标签的关键词
//   maxWaitSec 默认 300 (5 分钟)
//
// 退出码:
//   0 = 找到新 fork → stdout 输出新 dataId
//   1 = 超时未变化

const { findPageByLabel } = require('./find-page.js');
const { sleep } = require('./lib.js');

async function main() {
  const label = process.argv[2];
  const maxSec = parseInt(process.argv[3] || '300', 10);
  if (!label) { console.error('usage: node scripts/wait-fork.js <label> [maxSec]'); process.exit(2); }

  const before = await findPageByLabel(label);
  const beforeIds = new Set(before.filter(n => n.type === 'device').map(n => n.dataId));
  console.error(`[t=0] baseline: ${beforeIds.size} device nodes for "${label}"`);

  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < maxSec) {
    await sleep(15000);
    const now = await findPageByLabel(label);
    const newOnes = now.filter(n => n.type === 'device' && !beforeIds.has(n.dataId));
    const el = Math.round((Date.now() - t0) / 1000);
    if (newOnes.length > 0) {
      // Pick the newest (last in list, or with "修正版" suffix)
      const fixed = newOnes.find(n => /修正版|fixed|v2|v3/i.test(n.label)) || newOnes[newOnes.length - 1];
      console.error(`[t=${el}s] FOUND fork: ${fixed.dataId} | ${fixed.label}`);
      console.log(fixed.dataId);
      process.exit(0);
    }
    console.error(`[t=${el}s] no new fork yet (${now.filter(n=>n.type==='device').length} total)`);
  }
  console.error('TIMEOUT');
  process.exit(1);
}
main().catch(e => { console.error(e); process.exit(99); });
