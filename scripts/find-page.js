// 按页面标签定位 Stitch 画布上的 screen 节点
// 用法: node scripts/find-page.js "登录授权页"
//   → 输出 dataId, testid, w×h, text 摘要
//   → 命中 .react-flow__node-node-screen + textContent 以 "devices" 开头 + 后接给定标签

const { CDP_HOST, getCompanionId, rpc } = require('./lib.js');
const WebSocket = require('ws');

async function findPageByLabel(label) {
  const id = await getCompanionId();
  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + id);
  await new Promise(r => ws.on('open', r));
  const expr = `(function(){
    var nodes = document.querySelectorAll('.react-flow__node-node-screen');
    var out = [];
    Array.from(nodes).forEach(function(n){
      var t = (n.textContent||'').trim();
      var label = t.replace(/^devices/, '').replace(/^image/, '').trim().slice(0, 60);
      var rect = n.getBoundingClientRect();
      out.push({
        dataId: n.getAttribute('data-id'),
        testid: n.getAttribute('data-testid'),
        type: t.startsWith('devices') ? 'device' : (t.startsWith('image') ? 'image' : 'other'),
        label: label,
        textPreview: t.slice(0, 200),
        rect: {x:Math.round(rect.x), y:Math.round(rect.y), w:Math.round(rect.width), h:Math.round(rect.height)}
      });
    });
    return JSON.stringify(out);
  })()`;
  const r = await rpc(ws, 1, 'Runtime.evaluate', { expression: expr });
  ws.close();
  const all = JSON.parse(r.result.result.value);
  if (!label) return all;
  // 模糊匹配:label 包含查询词 (任一方向)
  const lower = label.toLowerCase();
  return all.filter(n => n.label.includes(label) || lower.split('').every(c => n.label.toLowerCase().includes(c) === false ? false : true) || n.textPreview.includes(label));
}

module.exports = { findPageByLabel };

if (require.main === module) {
  const q = process.argv[2];
  findPageByLabel(q).then(matches => {
    console.log(JSON.stringify(matches, null, 2));
    console.log('matches:', matches.length);
  }).catch(e => { console.error(e); process.exit(1); });
}
