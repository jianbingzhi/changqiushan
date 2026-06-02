// 通过 Agent log 左下角 menuitem 的 bg 状态判断 Stitch 任务是否结束
//
// 工作原理:Agent log 每条任务渲染为 [role="menuitem"]。最新(最顶部)那条:
//   · 进行中 → 内层 div class 含 "bg-state-active" + outline
//   · 已完成 → 内层 div class 含 "bg-transparent"
//
// 用法: node scripts/wait-agent-done.js [maxSec]
//   maxSec 默认 240(4 分钟)
//
// 退出码:0=完成 1=超时

const { CDP_HOST, getCompanionId, rpc, sleep } = require('./lib.js');
const WebSocket = require('ws');

async function getTopState() {
  const id = await getCompanionId();
  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + id);
  await new Promise(r => ws.on('open', r));
  try {
    const r = await rpc(ws, 1, 'Runtime.evaluate', { expression: `
      (function(){
        var items = document.querySelectorAll('[role="menuitem"]');
        var first = items[0];
        if (!first) return JSON.stringify({err:'no menuitem'});
        var inner = first.querySelector('div');
        if (!inner) return JSON.stringify({err:'no inner'});
        var cls = (inner.className||'').toString();
        var label = '';
        var span = first.querySelector('span.truncate, span.text-sm');
        if (span) label = (span.innerText||'').slice(0, 50);
        return JSON.stringify({
          active: /bg-state-active/.test(cls),
          done: /bg-transparent/.test(cls),
          label: label
        });
      })()
    ` });
    return JSON.parse(r.result?.result?.value || 'null');
  } finally {
    ws.close();
  }
}

async function main() {
  const maxSec = parseInt(process.argv[2] || '240', 10);
  const t0 = Date.now();
  let lastLabel = '';
  while ((Date.now() - t0) / 1000 < maxSec) {
    const s = await getTopState();
    const el = Math.round((Date.now() - t0) / 1000);
    if (!s) { console.error(`[t=${el}s] read err`); await sleep(3000); continue; }
    if (s.err) { console.error(`[t=${el}s] ${s.err}`); await sleep(3000); continue; }
    if (s.label !== lastLabel) {
      console.error(`[t=${el}s] top=${s.active?'ACTIVE':(s.done?'DONE':'?')} | ${s.label}`);
      lastLabel = s.label;
    } else if (el % 30 < 4) {
      console.error(`[t=${el}s] still ${s.active?'ACTIVE':(s.done?'DONE':'?')}`);
    }
    if (s.done) {
      console.error(`[t=${el}s] ✓ Stitch task DONE`);
      process.exit(0);
    }
    await sleep(4000);
  }
  console.error(`TIMEOUT @ ${maxSec}s`);
  process.exit(1);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(99); });

module.exports = { getTopState };
