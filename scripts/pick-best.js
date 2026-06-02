// 对每个 B 端页面,列出所有同名/相关 fork 节点,显示尺寸,辅助挑出"最佳"版本
const { findPageByLabel } = require('./find-page.js');
const { getCompanionId, rpc, CDP_HOST } = require('./lib.js');
const WebSocket = require('ws');

async function getStyle(dataId) {
  const id = await getCompanionId();
  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + id);
  await new Promise(r => ws.on('open', r));
  const r = await rpc(ws, 1, 'Runtime.evaluate', { expression: `(function(){var n=document.querySelector('[data-id="${dataId}"]');return n?JSON.stringify({sw:n.style.width,sh:n.style.height}):'NONE';})()` });
  ws.close();
  return JSON.parse(r.result?.result?.value || 'null');
}

const queries = [
  ['B01', '后台管理系统登录'],
  ['B02', '主框架'],
  ['B02', '后台管理系统仪表盘'],
  ['B03', '景区介绍维护-列表'],
  ['B04', '景区介绍维护-新建'],
  ['B05', '活动运营管理-列表'],
  ['B06', 'AI 问答知识库'],
  ['B07', '资讯模块'],
  ['B08', '分时预约配额配置'],
  ['B09', '渠道预约接入'],
  ['B10', '现场补录'],
  ['B11', '爽约风控'],
  ['B12', '实时路况'],
  ['B13', '停车场'],
  ['B14', '客流分析'],
  ['B15', '热力图分析'],
  ['B16', '来源分析'],
  ['B17', '用户画像总览'],
  ['B18', '用户画像 · 旅游出行'],
  ['B19', '用户画像 · APP'],
  ['B20', '物联网设备实时列表'],
  ['B21', '设备详情'],
];

(async () => {
  for (const [code, q] of queries) {
    const nodes = (await findPageByLabel(q)).filter(n => n.type === 'device');
    console.log(`\n=== ${code} | ${q} | ${nodes.length} matches ===`);
    for (const n of nodes) {
      const st = await getStyle(n.dataId);
      const sh = parseInt((st?.sh||'0').replace('px',''));
      console.log(`  ${n.dataId} | ${n.label.padEnd(30)} | ${st?.sw}x${st?.sh}`);
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
