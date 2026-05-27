// 会话状态 + 节点快照 + 日志 — 给 per-page 循环用
const { CDP_HOST, getCompanionId, rpc } = require('./lib.js');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = path.join(LOG_DIR, 'session-' + new Date().toISOString().slice(0, 10) + '.jsonl');

function log(entry) {
  fs.appendFileSync(LOG_FILE, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
}

// 抓所有 react-flow 节点的 testid + 标签摘要
async function snapshotNodes() {
  const compId = await getCompanionId();
  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + compId);
  await new Promise(r => ws.on('open', r));
  const expr = `(function(){
    var nodes = document.querySelectorAll('[data-id]');
    return JSON.stringify(Array.from(nodes).map(function(n){
      var rect = n.getBoundingClientRect();
      return {
        dataId: n.getAttribute('data-id'),
        testid: n.getAttribute('data-testid'),
        cls: (n.className || '').toString().slice(0, 80),
        text: (n.textContent || '').trim().slice(0, 120),
        w: Math.round(rect.width), h: Math.round(rect.height)
      };
    }));
  })()`;
  const r = await rpc(ws, 1, 'Runtime.evaluate', { expression: expr });
  ws.close();
  return JSON.parse(r.result.result.value);
}

// 找新增的节点 (after 里有,before 里没有的 dataId)
function diffNodes(before, after) {
  const beforeIds = new Set(before.map(n => n.dataId));
  return after.filter(n => !beforeIds.has(n.dataId));
}

module.exports = { log, snapshotNodes, diffNodes, LOG_FILE };

// 命令行: node scripts/session.js snapshot  → 打印当前节点
if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'snapshot') {
    snapshotNodes().then(nodes => {
      console.log(JSON.stringify(nodes, null, 2));
      console.log('total:', nodes.length);
    });
  }
}
