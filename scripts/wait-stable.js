// 等待 Stitch 节点稳定:每 10s 抓一次节点签名 (count + 每个节点的 text+rect 哈希),
// 连续 N 次签名相同则认为稳定。
// 用法: node scripts/wait-stable.js [stableCycles=4] [maxMinutes=15]
const { snapshotNodes } = require('./session.js');
const crypto = require('crypto');

function signature(nodes) {
  const data = nodes.map(n => `${n.dataId}|${n.cls.slice(0,30)}|${n.text.slice(0,200)}|${n.w}x${n.h}`).sort().join('\n');
  return crypto.createHash('md5').update(data).digest('hex').slice(0, 12);
}

async function main() {
  const stableCycles = parseInt(process.argv[2] || '4');
  const maxMinutes = parseInt(process.argv[3] || '15');
  const interval = 10000;

  let lastSig = null;
  let stable = 0;
  let lastCount = 0;
  const t0 = Date.now();

  for (let i = 0; i < (maxMinutes * 60 * 1000) / interval; i++) {
    const nodes = await snapshotNodes();
    const sig = signature(nodes);
    const elapsed = Math.round((Date.now() - t0) / 1000);
    const ts = new Date().toLocaleTimeString();

    if (sig === lastSig) {
      stable++;
      console.log(`${ts} [${elapsed}s] count=${nodes.length} sig=${sig} stable=${stable}/${stableCycles}`);
      if (stable >= stableCycles) {
        console.log('=== STABLE ===');
        console.log(JSON.stringify({ ok: true, elapsedSec: elapsed, count: nodes.length, finalSig: sig }));
        return;
      }
    } else {
      stable = 0;
      const delta = nodes.length - lastCount;
      console.log(`${ts} [${elapsed}s] count=${nodes.length} (${delta >= 0 ? '+' : ''}${delta}) sig=${sig} CHANGED`);
      lastSig = sig;
      lastCount = nodes.length;
    }
    await new Promise(r => setTimeout(r, interval));
  }
  console.log('=== TIMEOUT ===');
  console.log(JSON.stringify({ ok: false, elapsedSec: Math.round((Date.now() - t0) / 1000) }));
  process.exit(1);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
