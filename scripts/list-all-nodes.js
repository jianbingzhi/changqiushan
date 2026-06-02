// 列出 Stitch 画布所有节点 + 分类(final/fork/asset),给 dryRun 用
const { CDP_HOST, getCompanionId } = require('./lib.js');
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

// 最终保留的 dataId (STATUS.md / file-map 推导得到)
const FINAL_IDS = new Set([
  // 后台 B01..B21
  '6c7fe1084bb246c6aff002c7f1e98f27', // B01 登录
  '7e3000108add41a5bd1928d7c9a1b019', // B02 主框架
  'bd7b99d8d0b24134a647b660062101f1', // B03 介绍-列表(修正版)
  '8380ba793f994bf1a69ed3f954e20853', // B04 介绍-新建编辑
  'c407a6e3745f4b99aaa0491bf01cc988', // B05 活动运营-列表
  '25cf2ecddec8432782635bfcd61e102e', // B06 AI 问答(布局修复版 2026-05-28)
  '433c76de77d54148bac2560ec51a03f9', // B07 资讯模块(修正版)
  'bf729b72443540b9b3fdebc24a44399d', // B08 配额配置-详情
  'fa833464234e466c94468a1da59e55d8', // B09 渠道接入
  '863d5e7554374de3af6e563d76cdc411', // B10 现场补录(2026-05-28 fork)
  'b7a20a45421d448e97b8ec7536cef90c', // B11 爽约黑名单(2026-05-28 fork)
  '52201c2bf6fc4ae18f9793f43dac9218', // B12 路况查询
  'e40d7f5f46ae4064ba7e384c3517df61', // B13 停车场
  'aaaed96d971f4c6db7cbaeb76910cc5a', // B14 客流分析
  '00c7711144324b8685965277e84424ff', // B15 热力图分析(修正版)
  'fc834b50ea944d8bbac89f8848348364', // B16 来源分析
  '6d8568826ce6420e806c6e7ebebc4fcc', // B17 用户画像总览(导航统一版)
  '0df4402ac2b94c5fbecb3f3112a3c2a5', // B18 用户画像-出行
  '75407a71eff1493eb7966971ba00de3e', // B19 用户画像-APP(去 ligature 版)
  'a127629017934dc7abf6c254d21cb4e0', // B20 物联网设备列表(2026-05-28 fork)
  '12a0cf7f73e94754885d35aa14a5b96b', // B21 设备详情(2026-05-28 fork)

  // C 端小程序 A01..A11(从 file-map.json)
  '385ef4bfa1924d38a6d2330d980e126e', // A 登录授权
  'b486e10c8a4a469faf15a56b5f4e1b5c', // A 小程序首页
  '111db3ed71d54318896806d29de57150', // A 园区导览地图
  '382911a51422434dab506c40b9b70d59', // A 景区活动列表
  '376979e463134807a1c3b19e4bb28c39', // A 活动详情
  '6dbc7615cd444495b07bc41b5e8d840d', // A AI 智能问答
  '01dc65c771954136a0c0a1b6f7c33d5a', // A 预约日历与时段选择
  '743bd9ee9ab5412fa0fdb9563dae5b42', // A 预约信息填写
  '1049651c781f40d29cd7e150dc2741d8', // A 预约成功核销码
  '0923e33086cc439ca13e852d2b5cf196', // A 我的预约列表
  'abf572fff62047938c9e01f89c5a1447', // A 我的中心

  // 大屏 D01..D07
  '233f51791f9d484ab29f7fbf409d46e8', // D 数字大屏主屏 · 综合态势感知
  'bf3b83961f4549b08b2da076c38a25fa', // D 景区数据概览首屏
  'f9b99c191242455a995ee4a04d52f3ae', // D 数字孪生底座 · 导览图大屏
  '74c8ec719c5b4d1a942c22b42a43193a', // D 旅游产业与综合运营分析面板
  '97c21ff5bb2447ccab23bc87f1fdd7b4', // D 客流与预约趋势对比大屏
  'bfe038ecf35942a6891509c6ce2e1cb8', // D 预约分时热力图大屏
  '8d973f87b148459288c2282be73631bb', // D 运营宣传一张图
]);

(async () => {
  const compId = await getCompanionId();
  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + compId);
  await new Promise(r => ws.on('open', r));

  const all = JSON.parse((await eval2(ws, `(function(){
    var ns = document.querySelectorAll('.react-flow__node');
    var out = [];
    ns.forEach(function(n){
      var id = n.getAttribute('data-id');
      var m = (n.style.transform||'').match(/translate\\(([-\\d.]+)px,\\s*([-\\d.]+)px\\)/);
      var w = parseFloat(n.style.width)||0, h = parseFloat(n.style.height)||0;
      var cls = (n.className||'').toString();
      var nodeType = '';
      if (cls.indexOf('node-screen') >= 0) nodeType = 'screen';
      else if (cls.indexOf('node-image') >= 0) nodeType = 'image';
      else nodeType = 'other';
      var label = (n.innerText||'').trim().replace(/^(devices|image)/,'').trim().replace(/\\s+/g,' ').slice(0,60);
      out.push({ id, x: m?parseFloat(m[1]):null, y: m?parseFloat(m[2]):null, w, h, type: nodeType, label });
    });
    return JSON.stringify(out);
  })()`)).result.value);

  const finalIds = Array.from(FINAL_IDS);
  const finalSet = new Set(finalIds);

  const keep = all.filter(n => finalSet.has(n.id));
  const fork = all.filter(n => !finalSet.has(n.id) && n.type === 'screen');
  const asset = all.filter(n => !finalSet.has(n.id) && n.type !== 'screen');

  console.log('=== 节点总览 ===');
  console.log('总节点:', all.length);
  console.log('保留 (final):', keep.length, '/ 预期', finalIds.length);
  console.log('删除 (fork screen):', fork.length);
  console.log('删除 (asset/image/other):', asset.length);

  // 检查 final 集合中是否有缺失
  const seenIds = new Set(all.map(n => n.id));
  const missing = finalIds.filter(id => !seenIds.has(id));
  if (missing.length) {
    console.log('\\n⚠ FINAL 集合中找不到的节点:');
    missing.forEach(id => console.log('  ', id));
  }

  console.log('\\n=== 保留(final)节点详情 ===');
  keep.sort((a,b)=>a.y-b.y || a.x-b.x);
  keep.forEach(n => console.log(`  KEEP ${n.id.slice(0,8)} | ${n.w}x${n.h} | (${n.x},${n.y}) | ${n.label}`));

  console.log('\\n=== 删除候选(fork screen)详情 ===');
  fork.sort((a,b)=>a.label.localeCompare(b.label));
  fork.forEach(n => console.log(`  DEL  ${n.id.slice(0,8)} | ${n.w}x${n.h} | (${n.x},${n.y}) | ${n.label}`));

  console.log('\\n=== 删除候选(asset/image/other)详情 ===');
  asset.sort((a,b)=>a.y-b.y || a.x-b.x);
  asset.forEach(n => console.log(`  DEL  ${n.id.slice(0,8)} | ${n.w}x${n.h} | type=${n.type} | (${n.x},${n.y}) | ${n.label}`));

  // 落盘到 plan
  fs.writeFileSync('/tmp/delete-plan.json', JSON.stringify({
    keep: keep.map(n => ({id:n.id, label:n.label})),
    deleteScreen: fork.map(n => ({id:n.id, label:n.label, w:n.w, h:n.h})),
    deleteOther: asset.map(n => ({id:n.id, label:n.label, type:n.type})),
  }, null, 2));
  console.log('\\n=> 已落盘 /tmp/delete-plan.json');

  ws.close();
})().catch(e => { console.error(e); process.exit(1); });
