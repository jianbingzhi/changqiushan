// 重排 Stitch 画布:
// - Y=0    大屏 7 张      (1280×~1080 等宽,X step 1380)
// - Y=1580 后台 row 1 B01-B07  (7 列)
// - Y=5000 后台 row 2 B08-B14
// - Y=8000 后台 row 3 B15-B21
// - Y=11000 C 端 11 张     (390×~ 高,X step 440,起点 X=0)
// - Y=14000 素材 row 1     (8 张,X step 600)
// - Y=15500 素材 row 2     (8 张)
const { CDP_HOST, getCompanionId, sleep } = require('./lib.js');
const WebSocket = require('ws');

function eval2(ws, expr) {
  return new Promise(resolve => {
    const id = Math.floor(Math.random() * 100000);
    const onMsg = m => { const d = JSON.parse(m); if (d.id === id) { ws.off('message', onMsg); resolve(d.result); } };
    ws.on('message', onMsg);
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr } }));
  });
}

async function moveOne(ws, dataId, x, y) {
  return eval2(ws, `(function(){
    var rf = document.querySelector('.react-flow');
    var fk = Object.keys(rf).find(k => k.startsWith('__reactFiber'));
    var fiber = rf[fk]; var cur = fiber, fc = null;
    while (cur) { if (cur.memoizedProps && typeof cur.memoizedProps.onNodesChange === 'function') { fc = cur.memoizedProps.onNodesChange; break; } cur = cur.return; }
    if (!fc) return 'NO';
    fc([{ type: 'position', id: '${dataId}', position: { x: ${x}, y: ${y} }, dragging: false }]);
    return 'ok';
  })()`);
}

// 按行配置:每行的节点 dataId 顺序 + Y 起点 + X 步长 + 起点 X
const LAYOUT = [
  {
    label: '大屏 7 张',
    y: 0,
    x0: 0,
    xStep: 1380,
    ids: [
      '233f51791f9d484ab29f7fbf409d46e8', // D 数字大屏主屏 · 综合态势感知
      'bf3b83961f4549b08b2da076c38a25fa', // D 景区数据概览首屏
      'f9b99c191242455a995ee4a04d52f3ae', // D 数字孪生底座 · 导览图大屏
      '74c8ec719c5b4d1a942c22b42a43193a', // D 旅游产业与综合运营分析面板
      '97c21ff5bb2447ccab23bc87f1fdd7b4', // D 客流与预约趋势对比大屏
      'bfe038ecf35942a6891509c6ce2e1cb8', // D 预约分时热力图大屏
      '8d973f87b148459288c2282be73631bb', // D 运营宣传一张图
    ],
  },
  {
    label: '后台 row 1: B01 登录 / B02 主框架 / B03-B07 基础宣传管理',
    y: 1500,
    x0: 0,
    xStep: 1380,
    ids: [
      '6c7fe1084bb246c6aff002c7f1e98f27', // B01 登录
      '7e3000108add41a5bd1928d7c9a1b019', // B02 主框架
      'bd7b99d8d0b24134a647b660062101f1', // B03 介绍-列表(修正版)
      '8380ba793f994bf1a69ed3f954e20853', // B04 介绍-新建编辑
      'c407a6e3745f4b99aaa0491bf01cc988', // B05 活动运营-列表
      '25cf2ecddec8432782635bfcd61e102e', // B06 AI 问答(布局修复版)
      '433c76de77d54148bac2560ec51a03f9', // B07 资讯模块(修正版)
    ],
  },
  {
    label: '后台 row 2: B08-B14 预约管理 / 出行服务 / 数据分析(部分)',
    y: 5500,
    x0: 0,
    xStep: 1380,
    ids: [
      'bf729b72443540b9b3fdebc24a44399d', // B08 配额配置
      'fa833464234e466c94468a1da59e55d8', // B09 渠道接入
      '863d5e7554374de3af6e563d76cdc411', // B10 现场补录(2026-05-28 fork)
      'b7a20a45421d448e97b8ec7536cef90c', // B11 爽约黑名单(2026-05-28 fork)
      '52201c2bf6fc4ae18f9793f43dac9218', // B12 路况查询
      'e40d7f5f46ae4064ba7e384c3517df61', // B13 停车场
      'aaaed96d971f4c6db7cbaeb76910cc5a', // B14 客流分析
    ],
  },
  {
    label: '后台 row 3: B15-B21 热力图 / 来源 / 用户画像 / 物联网',
    y: 8500,
    x0: 0,
    xStep: 1380,
    ids: [
      '00c7711144324b8685965277e84424ff', // B15 热力图(修正版)
      'fc834b50ea944d8bbac89f8848348364', // B16 来源分析
      '6d8568826ce6420e806c6e7ebebc4fcc', // B17 用户画像总览(导航统一版)
      '0df4402ac2b94c5fbecb3f3112a3c2a5', // B18 出行偏好
      '75407a71eff1493eb7966971ba00de3e', // B19 APP 偏好(去 ligature 版)
      'a127629017934dc7abf6c254d21cb4e0', // B20 物联网设备列表(2026-05-28 fork)
      '12a0cf7f73e94754885d35aa14a5b96b', // B21 设备详情(2026-05-28 fork)
    ],
  },
  {
    label: 'C 端小程序 11 张',
    y: 12000,
    x0: 0,
    xStep: 440,
    ids: [
      '385ef4bfa1924d38a6d2330d980e126e', // A 登录授权
      'b486e10c8a4a469faf15a56b5f4e1b5c', // A 小程序首页
      '111db3ed71d54318896806d29de57150', // A 园区导览地图
      '382911a51422434dab506c40b9b70d59', // A 活动列表
      '376979e463134807a1c3b19e4bb28c39', // A 活动详情
      '6dbc7615cd444495b07bc41b5e8d840d', // A AI 智能问答
      '01dc65c771954136a0c0a1b6f7c33d5a', // A 预约日历
      '743bd9ee9ab5412fa0fdb9563dae5b42', // A 预约信息填写
      '1049651c781f40d29cd7e150dc2741d8', // A 预约成功核销码
      '0923e33086cc439ca13e852d2b5cf196', // A 我的预约列表
      'abf572fff62047938c9e01f89c5a1447', // A 我的中心
    ],
  },
  {
    label: '素材 row 1(Logo + 调色板 + 6 张图)',
    y: 15000,
    x0: 0,
    xStep: 600,
    ids: [
      'c17bce7b',                         // 长秋山 Logo  (前缀,完整 id 待补)
      // 其余 7 个素材用 ID 前缀填入下面,实际执行时按完整 ID 移动
    ],
    fillFromList: 'assets-part1',
  },
  {
    label: '素材 row 2(剩余 8 张图)',
    y: 16100,
    x0: 0,
    xStep: 600,
    ids: [],
    fillFromList: 'assets-part2',
  },
];

// 完整素材 ID 列表(共 16 个)
const ASSET_IDS_FULL = [
  'c17bce7b',                            // Logo
  // palette card has different id pattern — leave to runtime
  '6163c6f1', '2f6e635b', '6a911ad7', '5116265a', '7c50a6f7', '35681c85', '4cc271fa',
  'c68c6abd', '98224a12', '2fe60c05', '26fe4eeb', 'bdf3b650', 'ec8d9b17', 'c3b741d8',
];

(async () => {
  const compId = await getCompanionId();
  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + compId);
  await new Promise(r => ws.on('open', r));

  // 先拿到画布所有节点的完整 id 表,用于前缀解析
  const all = JSON.parse((await eval2(ws, `(function(){
    var ns = document.querySelectorAll('.react-flow__node');
    return JSON.stringify(Array.from(ns).map(function(n){return n.getAttribute('data-id')||'';}));
  })()`)).result.value);
  console.log('画布节点数:', all.length);

  function resolveId(prefix) {
    if (prefix.length >= 32) return prefix;
    const found = all.find(id => id.startsWith(prefix));
    return found || null;
  }

  // 算素材 row 内容(画布上 final 不在的)
  const usedIds = new Set();
  for (const row of LAYOUT) {
    if (row.fillFromList) continue;
    for (const id of row.ids) usedIds.add(resolveId(id) || id);
  }
  // assets 列表 = 全部 - usedIds
  const assets = all.filter(id => !usedIds.has(id));
  console.log('素材节点数:', assets.length);

  // 切两行
  const ROW_SIZE = 8;
  const assets1 = assets.slice(0, ROW_SIZE);
  const assets2 = assets.slice(ROW_SIZE);

  // 填回
  for (const row of LAYOUT) {
    if (row.fillFromList === 'assets-part1') row.ids = assets1;
    if (row.fillFromList === 'assets-part2') row.ids = assets2;
  }

  // 执行
  for (const row of LAYOUT) {
    console.log(`\n=== ${row.label} (Y=${row.y}) ===`);
    for (let i = 0; i < row.ids.length; i++) {
      const id = resolveId(row.ids[i]) || row.ids[i];
      const x = row.x0 + i * row.xStep;
      const r = await moveOne(ws, id, x, row.y);
      const ok = r.result?.value === 'ok';
      process.stdout.write(ok ? '.' : 'X');
      await sleep(120);
    }
    console.log('');
  }

  console.log('\n=== 完成 ===');
  ws.close();
})().catch(e => { console.error(e); process.exit(1); });
