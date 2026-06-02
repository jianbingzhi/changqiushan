// 通过 react-flow onNodesChange type='remove' 批量删除节点
// 用法: node scripts/delete-nodes.js <ids.json>
const { CDP_HOST, getCompanionId, sleep } = require('./lib.js');
const WebSocket = require('ws');
const fs = require('fs');

function eval2(ws, expr) {
  return new Promise(resolve => {
    const id = Math.floor(Math.random() * 100000);
    const onMsg = m => { const d = JSON.parse(m); if (d.id === id) { ws.off('message', onMsg); resolve(d.result); } };
    ws.on('message', onMsg);
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr } }));
  });
}

async function removeOne(ws, dataId) {
  const r = await eval2(ws, `(function(){
    var rf = document.querySelector('.react-flow');
    if (!rf) return 'no rf';
    var fk = Object.keys(rf).find(k => k.startsWith('__reactFiber'));
    if (!fk) return 'no fiber key';
    var fiber = rf[fk]; var cur = fiber, fc = null;
    while (cur) {
      if (cur.memoizedProps && typeof cur.memoizedProps.onNodesChange === 'function') {
        fc = cur.memoizedProps.onNodesChange; break;
      }
      cur = cur.return;
    }
    if (!fc) return 'no onNodesChange';
    fc([{ type: 'remove', id: '${dataId}' }]);
    return 'ok';
  })()`);
  return r.result?.value;
}

async function countNodes(ws) {
  const r = await eval2(ws, `document.querySelectorAll('.react-flow__node').length`);
  return r.result?.value;
}

(async () => {
  const idsFile = process.argv[2];
  if (!idsFile) { console.error('usage: node scripts/delete-nodes.js <ids.json>'); process.exit(1); }
  const ids = JSON.parse(fs.readFileSync(idsFile, 'utf-8'));
  console.log(`将删除 ${ids.length} 个节点`);

  const compId = await getCompanionId();
  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + compId);
  await new Promise(r => ws.on('open', r));

  const before = await countNodes(ws);
  console.log('删除前节点数:', before);

  let success = 0, fail = 0;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const r = await removeOne(ws, id);
    if (r === 'ok') { success++; process.stdout.write('.'); }
    else { fail++; console.log('\n  ✗', id, '→', r); }
    await sleep(120);
    if ((i+1) % 20 === 0) process.stdout.write(` [${i+1}/${ids.length}]\n`);
  }
  console.log('');

  await sleep(1500);
  const after = await countNodes(ws);
  console.log('\n=== 完成 ===');
  console.log('成功:', success, '失败:', fail);
  console.log('删除前/后节点数:', before, '→', after, '(差', before-after, ')');
  ws.close();
})().catch(e => { console.error(e); process.exit(1); });
