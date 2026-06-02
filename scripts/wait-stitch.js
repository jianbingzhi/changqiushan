// 等 Stitch 处理完毕。检测策略:
// 1. 监听目标 dataId 的 style.height 变化 — 变 → 重置稳定计数;不变 → 增加计数
// 2. 监听新 fork 出现 — 出现 → 立刻返回新 ID
// 3. 稳定 N 个 4s 周期后认为完成
// 4. 超时 maxSec 后返回 timeout
//
// 用法: node scripts/wait-stitch.js <dataId> <label> [maxSec]
// 输出 stdout: 最终采纳的 dataId(可能是原 id 也可能是 fork)
// 退出码: 0=完成 1=超时

const { CDP_HOST, getCompanionId, rpc, sleep } = require('./lib.js');
const { findPageByLabel } = require('./find-page.js');
const WebSocket = require('ws');

async function getHeight(ws, dataId) {
  const r = await rpc(ws, 1, 'Runtime.evaluate', { expression: `(function(){var n=document.querySelector('[data-id="${dataId}"]');return n?n.style.height:'';})()` });
  return r.result?.result?.value || '';
}

async function findNewFork(label, knownIds) {
  const nodes = (await findPageByLabel(label)).filter(n => n.type === 'device');
  return nodes.find(n => !knownIds.has(n.dataId));
}

async function main() {
  const [dataId, label, maxSecStr] = process.argv.slice(2);
  const maxSec = parseInt(maxSecStr || '420', 10); // 默认 7 分钟
  if (!dataId || !label) { console.error('usage: <dataId> <label> [maxSec]'); process.exit(2); }

  const compId = await getCompanionId();
  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + compId);
  await new Promise(r => ws.on('open', r));

  // 基线
  const knownNodes = (await findPageByLabel(label)).filter(n => n.type === 'device');
  const knownIds = new Set(knownNodes.map(n => n.dataId));
  let lastH = await getHeight(ws, dataId);
  let stable = 0;
  const STABLE_NEEDED = 4; // 4 * 5s = 20s 不变即认为稳定

  console.error(`[t=0] start: dataId=${dataId.slice(0,8)} h=${lastH} known=${knownIds.size}`);

  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < maxSec) {
    await sleep(5000);
    const el = Math.round((Date.now() - t0) / 1000);

    // 检查新 fork
    const fork = await findNewFork(label, knownIds);
    if (fork) {
      console.error(`[t=${el}s] ✓ FORK: ${fork.dataId}`);
      ws.close();
      console.log(fork.dataId);
      process.exit(0);
    }

    // 检查高度
    const h = await getHeight(ws, dataId);
    if (h !== lastH) {
      console.error(`[t=${el}s] in-place: h ${lastH} → ${h}`);
      lastH = h;
      stable = 0;
    } else {
      stable++;
      if (el % 30 < 5) console.error(`[t=${el}s] h=${h} stable=${stable}/${STABLE_NEEDED}`);
      // 只在高度已经"动过"一次后才接受 stable 完成
      // (避免一开始就稳定误判)
    }
  }

  console.error(`TIMEOUT @ ${maxSec}s — using original ${dataId.slice(0,8)}`);
  ws.close();
  console.log(dataId);
  process.exit(1);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(99); });
