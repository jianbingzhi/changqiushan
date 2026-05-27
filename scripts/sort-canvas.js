// 按交付文件的真实 dataId 重新分组 + 排序
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

async function moveOne(ws, dataId, x, y, label) {
  const r = await eval2(ws, `(function(){
    var rf = document.querySelector('.react-flow');
    var fk = Object.keys(rf).find(k => k.startsWith('__reactFiber'));
    var fiber = rf[fk]; var cur = fiber, fc = null;
    while (cur) { if (cur.memoizedProps && typeof cur.memoizedProps.onNodesChange === 'function') { fc = cur.memoizedProps.onNodesChange; break; } cur = cur.return; }
    fc([{ type: 'position', id: '${dataId}', position: { x: ${x}, y: ${y} }, dragging: false }]);
    return 'ok';
  })()`);
  console.log('  ✓', label.padEnd(40), `(${x}, ${y})`);
}

(async () => {
  const compId = await getCompanionId();
  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + compId);
  await new Promise(r => ws.on('open', r));
  
  // === 读 canvas 上所有节点位置+高度 ===
  const allNodes = JSON.parse((await eval2(ws, `(function(){
    var ns = document.querySelectorAll('.react-flow__node');
    var out = [];
    ns.forEach(function(n){
      var dataId = n.getAttribute('data-id');
      var m = (n.style.transform || '').match(/translate\\(([-\\d.]+)px,\\s*([-\\d.]+)px\\)/);
      var txt = (n.innerText || '').replace(/\\s+/g,' ').slice(0,60);
      out.push({ id: dataId, w: parseFloat(n.style.width)||0, h: parseFloat(n.style.height)||0, txt });
    });
    return JSON.stringify(out);
  })()`)).result.value);
  
  const byId = {};
  allNodes.forEach(n => byId[n.id] = n);
  
  function findId(matcher) {
    return allNodes.find(n => matcher(n.txt));
  }
  
  // 大屏 C (7) - 单 row
  const C = [
    { match: t => t.includes('数字大屏主屏'), pick: '233f5179', label: '数字大屏主屏' },
    { match: t => t.includes('旅游产业与综合运营') || t.includes('综合运营'), pick: 'e5435640', label: '综合运营态势面板' },
    { match: t => t.includes('景区数据概览首屏'), pick: 'bf3b8396', label: '景区数据概览首屏' },
    { match: t => t.includes('客流与预约趋势'), pick: '97c21ff5', label: '客流预约趋势对比' },
    { match: t => t.includes('预约分时热力图'), pick: 'bfe038ec', label: '预约分时热力图' },
    { match: t => t.includes('数字孪生底座'), pick: 'f9b99c19', label: '数字孪生底座导览图' },
    { match: t => t.includes('运营宣传一张图'), pick: '8d973f87', label: '运营宣传一张图' }
  ];
  
  // 后台 B 行 1: 系统 + 内容
  const B1 = [
    { pick: '6c7fe108', label: '后台登录' },
    { pick: '7e300010', label: '主框架与仪表盘' },
    { pick: '498a68a8', label: '景区介绍维护-列表' },
    { pick: '8380ba79', label: '景区介绍维护-新建/编辑' },
    { pick: 'c407a6e3', label: '活动运营管理' },
    { pick: '3aa9715e', label: 'AI 问答知识库' },
    { pick: 'bc2950db', label: '资讯模块' }
  ];
  // 后台 B 行 2: 预约 + 通行
  const B2 = [
    { pick: 'e44f469c', label: '分时预约配额配置' },
    { pick: 'fa833464', label: '渠道预约接入管理' },
    { pick: '79e408b4', label: '现场补录面板' },
    { pick: 'f599d326', label: '爽约风控与黑名单' },
    { pick: '3086df6e', label: '实时路况查询' },
    { pick: 'e40d7f5f', label: '停车场动静态上图' }
  ];
  // 后台 B 行 3: 分析 + 画像 + 物联
  const B3 = [
    { pick: 'aaaed96d', label: '客流分析' },
    { pick: '47c25c18', label: '热力图分析' },
    { pick: 'fc834b50', label: '来源分析' },
    { pick: 'adb3b1e9', label: '用户画像总览' },
    { pick: '0df4402a', label: '用户画像-出行偏好' },
    { pick: '3fb21fe9', label: '用户画像-APP偏好' },
    { pick: 'f630bd67', label: '物联网设备实时列表' },
    { pick: 'f2e3bb32', label: '设备详情与心跳监测' }
  ];
  
  // C 端 A (11) — 按用户流
  const A = [
    { pick: '385ef4bf', label: 'A1 登录授权' },
    { pick: 'b486e10c', label: 'A2 小程序首页' },
    { pick: '111db3ed', label: 'A10 园区导览' },
    { pick: '382911a5', label: 'A8 景区活动列表' },
    { pick: '376979e4', label: 'A9 活动详情' },
    { pick: '6dbc7615', label: 'A7 AI 智能问答' },
    { pick: '01dc65c7', label: 'A3 预约日历' },
    { pick: '743bd9ee', label: 'A4 填写预约' },
    { pick: '1049651c', label: 'A5 预约成功核销' },
    { pick: '0923e330', label: 'A6 我的预约列表' },
    { pick: 'abf572ff', label: 'A11 我的中心' }
  ];
  
  // 找完整 dataId
  function fullId(prefix) {
    return allNodes.find(n => n.id.startsWith(prefix)).id;
  }
  [C, B1, B2, B3, A].forEach(grp => grp.forEach(x => { try { x.fullId = fullId(x.pick); x.h = byId[x.fullId].h; } catch(e) { console.error('MISS:', x.pick, x.label); } }));
  
  // 计算行高
  const maxH = arr => Math.max(...arr.map(x => x.h || 1000));
  
  // === 布局参数 ===
  const X_A = 440;    // 手机 390 + 50 间隙
  const X_DESKTOP = 1380; // 桌面 1280 + 100 间隙
  const Y_GAP = 500;  // 行间额外缓冲
  
  // 计算 Y 行起点(top-down): 大屏 → 后台 3 行 → C 端
  let Y = 0;
  const C_Y = Y; Y += maxH(C) + Y_GAP;
  const B1_Y = Y; Y += maxH(B1) + Y_GAP;
  const B2_Y = Y; Y += maxH(B2) + Y_GAP;
  const B3_Y = Y; Y += maxH(B3) + Y_GAP;
  const A_Y = Y; Y += maxH(A) + Y_GAP;
  const FORK_Y = Y + 1000;  // 冷宫
  
  console.log('=== Y 行计算 ===');
  console.log('大屏 C:    Y=', C_Y, ' max H=', maxH(C));
  console.log('后台 B1:   Y=', B1_Y, ' max H=', maxH(B1));
  console.log('后台 B2:   Y=', B2_Y, ' max H=', maxH(B2));
  console.log('后台 B3:   Y=', B3_Y, ' max H=', maxH(B3));
  console.log('C 端 A:    Y=', A_Y, ' max H=', maxH(A));
  console.log('冷宫 fork: Y=', FORK_Y);
  
  // === 执行 ===
  console.log('\n=== 大屏 C ===');
  for (let i = 0; i < C.length; i++) await moveOne(ws, C[i].fullId, i * X_DESKTOP, C_Y, C[i].label), await sleep(200);
  
  console.log('\n=== 后台 B 行 1 ===');
  for (let i = 0; i < B1.length; i++) await moveOne(ws, B1[i].fullId, i * X_DESKTOP, B1_Y, B1[i].label), await sleep(200);
  
  console.log('\n=== 后台 B 行 2 ===');
  for (let i = 0; i < B2.length; i++) await moveOne(ws, B2[i].fullId, i * X_DESKTOP, B2_Y, B2[i].label), await sleep(200);
  
  console.log('\n=== 后台 B 行 3 ===');
  for (let i = 0; i < B3.length; i++) await moveOne(ws, B3[i].fullId, i * X_DESKTOP, B3_Y, B3[i].label), await sleep(200);
  
  console.log('\n=== C 端 A (紧凑) ===');
  for (let i = 0; i < A.length; i++) await moveOne(ws, A[i].fullId, i * X_A, A_Y, A[i].label), await sleep(200);
  
  // === Fork + Asset 全部移到冷宫 ===
  const finalIds = new Set([...C, ...B1, ...B2, ...B3, ...A].map(x => x.fullId));
  const rest = allNodes.filter(n => !finalIds.has(n.id));
  console.log('\n=== Fork+Asset 移冷宫', rest.length, '个 ===');
  for (let i = 0; i < rest.length; i++) {
    const row = Math.floor(i / 12);
    const col = i % 12;
    await moveOne(ws, rest[i].id, col * X_DESKTOP, FORK_Y + row * 2800, '[OFF] ' + rest[i].txt.slice(0,30));
    await sleep(200);
  }
  
  console.log('\n=== 完成,等 2s 验证 ===');
  await sleep(2000);
  
  // 最终验证:每行底边 vs 下行起点
  const final = JSON.parse((await eval2(ws, `(function(){
    var ns = document.querySelectorAll('.react-flow__node');
    var out = [];
    ns.forEach(function(n){
      var m = (n.style.transform || '').match(/translate\\(([-\\d.]+)px,\\s*([-\\d.]+)px\\)/);
      out.push({ id:n.getAttribute('data-id'), x: m?parseFloat(m[1]):0, y: m?parseFloat(m[2]):0, h: parseFloat(n.style.height)||0 });
    });
    return JSON.stringify(out);
  })()`)).result.value);
  
  const rows = [
    { name: '大屏 C', Y: C_Y, ids: C.map(x=>x.fullId) },
    { name: '后台 B1', Y: B1_Y, ids: B1.map(x=>x.fullId) },
    { name: '后台 B2', Y: B2_Y, ids: B2.map(x=>x.fullId) },
    { name: '后台 B3', Y: B3_Y, ids: B3.map(x=>x.fullId) },
    { name: 'C 端 A', Y: A_Y, ids: A.map(x=>x.fullId) }
  ];
  console.log('\n=== 行间缓冲验证 ===');
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNodes = final.filter(n => r.ids.includes(n.id));
    const maxBot = Math.max(...rowNodes.map(n => n.y + n.h));
    const next = i+1 < rows.length ? rows[i+1].Y : null;
    console.log(`  ${r.name}: Y=${r.Y}, 下沿=${Math.round(maxBot)}, 下一行 Y=${next||'-'}, 缓冲=${next?Math.round(next-maxBot):'-'}`);
  }
  
  ws.close();
  process.exit(0);
})();
