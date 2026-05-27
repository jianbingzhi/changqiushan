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

async function moveOne(ws, dataId, x, y) {
  await eval2(ws, `(function(){
    var rf = document.querySelector('.react-flow');
    var fk = Object.keys(rf).find(k => k.startsWith('__reactFiber'));
    var fiber = rf[fk]; var cur = fiber, fc = null;
    while (cur) { if (cur.memoizedProps && typeof cur.memoizedProps.onNodesChange === 'function') { fc = cur.memoizedProps.onNodesChange; break; } cur = cur.return; }
    fc([{ type: 'position', id: '${dataId}', position: { x: ${x}, y: ${y} }, dragging: false }]);
  })()`);
}

const FINAL_PREFIX = new Set([
  '233f5179','e5435640','bf3b8396','97c21ff5','bfe038ec','f9b99c19','8d973f87',
  '6c7fe108','7e300010','498a68a8','8380ba79','c407a6e3','3aa9715e','bc2950db',
  'e44f469c','fa833464','79e408b4','f599d326','3086df6e','e40d7f5f',
  'aaaed96d','47c25c18','fc834b50','adb3b1e9','0df4402a','3fb21fe9','f630bd67','f2e3bb32',
  '385ef4bf','b486e10c','111db3ed','382911a5','376979e4','6dbc7615','01dc65c7','743bd9ee','1049651c','0923e330','abf572ff'
]);

(async () => {
  const compId = await getCompanionId();
  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + compId);
  await new Promise(r => ws.on('open', r));
  
  // 读所有节点
  const all = JSON.parse((await eval2(ws, `(function(){
    var ns = document.querySelectorAll('.react-flow__node');
    var out = [];
    ns.forEach(function(n){
      var id = n.getAttribute('data-id');
      var m = (n.style.transform||'').match(/translate\\(([-\\d.]+)px,\\s*([-\\d.]+)px\\)/);
      var w = parseFloat(n.style.width)||0, h = parseFloat(n.style.height)||0;
      var txt = (n.innerText||'').replace(/\\s+/g,' ').slice(0,80);
      out.push({ id, x: m?parseFloat(m[1]):null, y: m?parseFloat(m[2]):null, w, h, txt });
    });
    return JSON.stringify(out);
  })()`)).result.value);
  
  // 区分 final / 非 final
  const isFinal = n => Array.from(FINAL_PREFIX).some(p => n.id.startsWith(p));
  const cold = all.filter(n => !isFinal(n));
  
  // 分类
  function classify(n) {
    const t = n.txt;
    // image / palette / 没有 "devices" 前缀 = asset
    if (/^(image |palette|assets)/i.test(t) || t === '' || (!t.startsWith('devices') && n.w < 800)) {
      return 'asset';
    }
    // devices xxx — 看尺寸 & 内容
    // A 手机: width 约 390
    if (n.w <= 500) return 'A_fork';
    // C 大屏 fork: 含 "大屏" 字样
    if (/大屏|综合运营|趋势对比|分时热力|数字孪生|运营宣传|景区数据概览|画像|出行偏好|APP/.test(t)) return 'C_fork';
    // 其余宽节点 = B 后台 fork
    return 'B_fork';
  }
  
  const groups = { A_fork: [], B_fork: [], C_fork: [], asset: [] };
  cold.forEach(n => groups[classify(n)].push(n));
  
  console.log('=== 冷宫分类 ===');
  console.log('A_fork:', groups.A_fork.length);
  console.log('B_fork:', groups.B_fork.length);
  console.log('C_fork:', groups.C_fork.length);
  console.log('asset:', groups.asset.length);
  console.log('总:', cold.length);
  
  // 详细输出
  ['A_fork','B_fork','C_fork','asset'].forEach(k => {
    console.log('\\n--- ' + k + ' ---');
    groups[k].forEach(n => console.log('  ', n.id.slice(0,8), 'w='+n.w, '|', n.txt.slice(0,55)));
  });
  
  // 新冷宫布局:Y=13000 起,每组一带,带间留 1000 缓冲
  // A_fork: 节点窄(390),X step 440,1 行
  // B_fork: 节点宽(1280),X step 1380, ~25 个 → 3 行(12+12+1)
  // C_fork: X step 1380,~8 个 → 1 行
  // asset: 杂,X step 600,~19 个 → 2 行 (12+7)
  
  const Y_BASE = 13000;
  const X_NARROW = 440;
  const X_WIDE = 1380;
  const X_ASSET = 650;
  
  let curY = Y_BASE;
  
  // A_fork 行
  console.log('\\n=== 移动 A_fork → Y=' + curY + ' ===');
  for (let i = 0; i < groups.A_fork.length; i++) {
    await moveOne(ws, groups.A_fork[i].id, i * X_NARROW, curY);
    process.stdout.write('.');
    await sleep(150);
  }
  console.log('');
  curY += 2000;  // A fork 高度 800-1900,留 2000 行高
  
  // B_fork 行 (3 sub-rows)
  console.log('=== 移动 B_fork (3 sub-rows) ===');
  const bPerRow = 12;
  for (let i = 0; i < groups.B_fork.length; i++) {
    const subRow = Math.floor(i / bPerRow);
    const col = i % bPerRow;
    await moveOne(ws, groups.B_fork[i].id, col * X_WIDE, curY + subRow * 2800);
    process.stdout.write('.');
    await sleep(150);
  }
  console.log('');
  const bSubRows = Math.ceil(groups.B_fork.length / bPerRow);
  curY += bSubRows * 2800;
  
  // C_fork 行
  console.log('=== 移动 C_fork → Y=' + curY + ' ===');
  for (let i = 0; i < groups.C_fork.length; i++) {
    await moveOne(ws, groups.C_fork[i].id, i * X_WIDE, curY);
    process.stdout.write('.');
    await sleep(150);
  }
  console.log('');
  curY += 2800;
  
  // asset 行
  console.log('=== 移动 asset (2 sub-rows) → Y=' + curY + ' ===');
  const assetPerRow = 12;
  for (let i = 0; i < groups.asset.length; i++) {
    const subRow = Math.floor(i / assetPerRow);
    const col = i % assetPerRow;
    await moveOne(ws, groups.asset[i].id, col * X_ASSET, curY + subRow * 1200);
    process.stdout.write('.');
    await sleep(150);
  }
  console.log('');
  
  console.log('\\n完成');
  ws.close();
  process.exit(0);
})();
