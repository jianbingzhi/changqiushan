// Stitch 页面导出脚本 — 逐页选中 → Export .zip → 下载 → 解压 → 重命名 → 移动到 UI 目录
//
// 用法:
//   node scripts/export.js <page_index>          # 导出指定页 (1-based)
//   node scripts/export.js all                   # 批量导出所有页
//
// 依赖: lib.js (同目录), ws (npm install ws)

const { CDP_HOST, getCompanionId, getPageNodes, rpc, sleep, randomDelay, dismissToasts } = require('./lib.js');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ========== 配置 ==========

const DL = '/mnt/z/Download';       // Chrome 下载目录
const TMP = '/tmp/stitch_tmp';      // 临时解压目录
const UI = path.join(__dirname, '..', 'UI');  // 项目 UI 截图目录

// Export 按钮坐标 (在 companion iframe 内)
const EXPORT_BTN = {x: 2343, y: 36};
const ZIP_LABEL = {x: 2348, y: 455};
const EXPORT_DIALOG_BTN = {x: 2348, y: 1197};

// ========== 页面目录映射 (思维导图结构) ==========

const PAGE_MAP = [
  {name:'长白山智慧景区全域指挥中心 - 客源图谱融合版 (3840x1080)', dir:'01_数据大屏'},
  {name:'长白山智慧景区管理系统 - 主框架布局 (浅色版)', dir:'02_后台管理/01_主框架'},
  {name:'基础与权限设置 - 角色权限与日志审计 (浅色版)', dir:'02_后台管理/02_基础权限'},
  {name:'基础与权限设置 - 组织权限管理 (浅色版)', dir:'02_后台管理/02_基础权限'},
  {name:'基础与权限设置 - 用户管理 (浅色版)', dir:'02_后台管理/02_基础权限'},
  {name:'基础与权限设置 - 操作日志 (浅色版)', dir:'02_后台管理/02_基础权限'},
  {name:'基础与权限设置 - 部门管理 (浅色版)', dir:'02_后台管理/02_基础权限'},
  {name:'基础数据管理 - 景点档案与业务配置工作台 (浅色版)', dir:'02_后台管理/03_基础数据'},
  {name:'基础数据管理 - 票种管理 (浅色版)', dir:'02_后台管理/03_基础数据'},
  {name:'基础数据管理 - 商户档案 (浅色版)', dir:'02_后台管理/03_基础数据'},
  {name:'基础数据管理 - 车辆档案 (浅色版)', dir:'02_后台管理/03_基础数据'},
  {name:'票务中心 - 票务配置与分销 (浅色版)', dir:'02_后台管理/04_票务中心'},
  {name:'票务中心 - 退票审核工作流 (浅色版)', dir:'02_后台管理/04_票务中心'},
  {name:'客户管理 - 客户列表与新增 (浅色版)', dir:'02_后台管理/05_客户管理'},
  {name:'客户管理 - 客户360视图 (浅色版)', dir:'02_后台管理/05_客户管理'},
  {name:'订单管理 - 列表与详情抽屉 (浅色版)', dir:'02_后台管理/06_订单管理'},
  {name:'我的订单 - 订单列表 (浅色版)', dir:'02_后台管理/06_订单管理'},
  {name:'库存管理 - 库存查询与预警看板 (浅色版)', dir:'02_后台管理/07_库存管理'},
  {name:'库存管理 - 入库管理 (浅色版)', dir:'02_后台管理/07_库存管理'},
  {name:'库存管理 - 出库管理 (浅色版)', dir:'02_后台管理/07_库存管理'},
  {name:'库存管理 - 库存盘点 (浅色版)', dir:'02_后台管理/07_库存管理'},
  {name:'接驳车调度 - 车辆指派调度工作台 (浅色版)', dir:'02_后台管理/08_接驳车调度'},
  {name:'接驳车调度 - 实时在途跟踪可视化 (浅色版)', dir:'02_后台管理/08_接驳车调度'},
  {name:'财务管理 - 收入概览 (浅色版)', dir:'02_后台管理/09_财务管理'},
  {name:'财务管理 - 应收账款 (浅色版)', dir:'02_后台管理/09_财务管理'},
  {name:'财务管理 - 应付账款 (浅色版)', dir:'02_后台管理/09_财务管理'},
  {name:'财务管理 - 成本分析 (浅色版)', dir:'02_后台管理/09_财务管理'},
  {name:'报表中心 - 预置报表 (浅色版)', dir:'02_后台管理/10_报表中心'},
  {name:'报表中心 - 自定义报表 (浅色版)', dir:'02_后台管理/10_报表中心'},
  {name:'物联网监控 - 设备实时列表 (浅色版)', dir:'02_后台管理/11_物联网监控'},
  {name:'物联网监控 - 设备全量监控与实时告警工作台 (浅色版)', dir:'02_后台管理/11_物联网监控'},
  {name:'运营数据分析 - 客流画像 (浅色版)', dir:'02_后台管理/12_运营分析'},
  {name:'系统设置 - 全功能配置工作台 (浅色版)', dir:'02_后台管理/13_系统设置'},
  {name:'系统设置 - 编号规则 (浅色版)', dir:'02_后台管理/13_系统设置'},
  {name:'系统设置 - 消息模板 (浅色版)', dir:'02_后台管理/13_系统设置'},
  {name:'系统设置 - 数据字典 (浅色版)', dir:'02_后台管理/13_系统设置'},
  {name:'注册登录 - 欢迎页 (浅色版)', dir:'03_C端小程序/01_注册登录'},
  {name:'新用户注册 - 企业信息录入 (浅色版)', dir:'03_C端小程序/01_注册登录'},
  {name:'长白山导览小程序 - 首页 (浅色优化版)', dir:'03_C端小程序/02_首页'},
  {name:'产品详情 - 长白山景区门票 (浅色版)', dir:'03_C端小程序/03_产品浏览'},
  {name:'搜索结果 - 寻找心仪产品 (浅色版)', dir:'03_C端小程序/03_产品浏览'},
  {name:'景区文旅商城 (浅色版)', dir:'03_C端小程序/03_产品浏览'},
  {name:'购物车 - 准备结算', dir:'03_C端小程序/04_购物车'},
  {name:'确认订单 - 核对信息', dir:'03_C端小程序/05_下单流程'},
  {name:'订单详情 - 订单号:CB88920134', dir:'03_C端小程序/06_订单管理'},
  {name:'个人中心 - 主页 (浅色版)', dir:'03_C端小程序/07_个人中心'},
  {name:'个人中心 - 对账中心 (浅色版)', dir:'03_C端小程序/07_个人中心'},
  {name:'消息中心 - 列表页', dir:'03_C端小程序/08_消息中心'},
  {name:'消息设置', dir:'03_C端小程序/08_消息中心'},
  {name:'消息详情 - 订单类', dir:'03_C端小程序/08_消息中心'},
  {name:'门票预约 (浅色版)', dir:'03_C端小程序/09_导览服务'},
  {name:'智能导览/语音讲解 (浅色版)', dir:'03_C端小程序/09_导览服务'},
  {name:'官方推荐线路 (浅色版)', dir:'03_C端小程序/09_导览服务'}
];

function safeName(name) {
  return name.replace(/[\/\\:*?"<>|]/g, '_').substring(0, 60);
}

// ========== 单页导出 ==========

async function exportOnePage(compWs, page, index, total) {
  const sfx = '[' + index + '/' + total + ']';
  console.log(sfx + ' ' + page.name);

  // 1. 检查下载目录
  let dlFiles = fs.readdirSync(DL).filter(f => f.endsWith('.zip'));
  if (dlFiles.length > 0) {
    console.log(sfx + ' WARN: Download dir has ' + dlFiles.length + ' leftover zips, cleaning...');
    dlFiles.forEach(f => fs.unlinkSync(path.join(DL, f)));
  }

  // 2. 关闭残留对话框和 toast
  await rpc(compWs, 1, 'Input.dispatchKeyEvent', {type:'keyDown', key:'Escape', code:'Escape'});
  await rpc(compWs, 2, 'Input.dispatchKeyEvent', {type:'keyUp', key:'Escape', code:'Escape'});
  await sleep(300);
  await dismissToasts(compWs);
  await sleep(300);

  // 3. 查找页面节点
  const nodes = await getPageNodes(compWs);
  const node = nodes.find(n => n.name === page.name);
  if (!node) { console.log(sfx + ' FAIL: Node not found on canvas'); return false; }

  // 4. 点击节点选中
  await rpc(compWs, 10, 'Input.dispatchMouseEvent', {type:'mousePressed', x:node.x, y:node.y, button:'left', clickCount:1});
  await rpc(compWs, 11, 'Input.dispatchMouseEvent', {type:'mouseReleased', x:node.x, y:node.y, button:'left', clickCount:1});
  await sleep(400);

  // 5. 点击 Export 按钮 → 选择 .zip → 点击 Export
  await rpc(compWs, 20, 'Input.dispatchMouseEvent', {type:'mousePressed', x:EXPORT_BTN.x, y:EXPORT_BTN.y, button:'left', clickCount:1});
  await rpc(compWs, 21, 'Input.dispatchMouseEvent', {type:'mouseReleased', x:EXPORT_BTN.x, y:EXPORT_BTN.y, button:'left', clickCount:1});
  await sleep(1000);

  await rpc(compWs, 30, 'Input.dispatchMouseEvent', {type:'mousePressed', x:ZIP_LABEL.x, y:ZIP_LABEL.y, button:'left', clickCount:1});
  await rpc(compWs, 31, 'Input.dispatchMouseEvent', {type:'mouseReleased', x:ZIP_LABEL.x, y:ZIP_LABEL.y, button:'left', clickCount:1});
  await sleep(400);

  await rpc(compWs, 40, 'Input.dispatchMouseEvent', {type:'mousePressed', x:EXPORT_DIALOG_BTN.x, y:EXPORT_DIALOG_BTN.y, button:'left', clickCount:1});
  await rpc(compWs, 41, 'Input.dispatchMouseEvent', {type:'mouseReleased', x:EXPORT_DIALOG_BTN.x, y:EXPORT_DIALOG_BTN.y, button:'left', clickCount:1});

  // 6. 等待下载完成 (轮询 /mnt/z/Download)
  let zipFile = null;
  for (let w = 0; w < 60; w++) {
    await sleep(1000);
    try {
      const files = fs.readdirSync(DL).filter(f => f.endsWith('.zip'));
      if (files.length === 1) { zipFile = files[0]; break; }
    } catch(e) {}
  }
  if (!zipFile) { console.log(sfx + ' FAIL: No download after 60s'); return false; }

  const zipPath = path.join(DL, zipFile);
  console.log(sfx + ' Downloaded: ' + zipFile + ' (' + fs.statSync(zipPath).size + ' bytes)');

  // 7. 解压
  try { fs.rmSync(TMP, {recursive: true, force: true}); } catch(e) {}
  fs.mkdirSync(TMP, {recursive: true});
  try {
    execSync('unzip -o "' + zipPath + '" -d ' + TMP, {stdio: 'pipe'});
  } catch(e) {
    console.log(sfx + ' FAIL: unzip error');
    fs.unlinkSync(zipPath);
    return false;
  }

  // 8. 验证解压内容
  const srcPng = path.join(TMP, 'screen.png');
  const srcMd = path.join(TMP, 'DESIGN.md');
  if (!fs.existsSync(srcPng)) {
    console.log(sfx + ' FAIL: no screen.png in zip');
    fs.unlinkSync(zipPath);
    return false;
  }

  // 读取 title 验证 (如果有 code.html)
  const htmlPath = path.join(TMP, 'code.html');
  let title = '?';
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const m = html.match(/<title>([^<]+)<\/title>/);
    if (m) title = m[1];
  }

  // 9. 移动并重命名文件到 UI 目录
  const destDir = path.join(UI, page.dir);
  const destPng = path.join(destDir, safeName(page.name) + '.png');
  const destMd = path.join(destDir, safeName(page.name) + '.md');

  fs.copyFileSync(srcPng, destPng);
  if (fs.existsSync(srcMd)) fs.copyFileSync(srcMd, destMd);

  console.log(sfx + ' Saved: ' + safeName(page.name) + '.png (' + fs.statSync(destPng).size + ' bytes) title=' + title);

  // 10. 清理
  fs.unlinkSync(zipPath);
  try { fs.rmSync(TMP, {recursive: true, force: true}); } catch(e) {}

  // 11. 等待右下角 toast 消失 + 随机延迟模拟人工
  console.log(sfx + ' Waiting for toast + cooldown...');
  await sleep(3000);  // 等 toast 出现
  await dismissToasts(compWs);
  await randomDelay(10000, 20000);  // 随机 10-20 秒

  return true;
}

// ========== 主流程 ==========

async function main() {
  const arg = process.argv[2] || '1';

  const compId = await getCompanionId();
  if (!compId) { console.error('No companion iframe found. Is Stitch open?'); return; }

  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + compId);
  await new Promise(r => ws.on('open', r));

  if (arg === 'all') {
    // 批量导出全部
    console.log('=== Batch export ' + PAGE_MAP.length + ' pages ===\n');
    let ok = 0, fail = 0;
    for (let i = 0; i < PAGE_MAP.length; i++) {
      const success = await exportOnePage(ws, PAGE_MAP[i], i + 1, PAGE_MAP.length);
      if (success) ok++; else fail++;
    }
    console.log('\n=== Done: ' + ok + ' OK, ' + fail + ' FAIL ===');
  } else {
    // 导出单页
    const idx = parseInt(arg);
    if (idx < 1 || idx > PAGE_MAP.length) {
      console.log('Invalid index: ' + idx + ' (1-' + PAGE_MAP.length + ')');
      ws.close();
      return;
    }
    await exportOnePage(ws, PAGE_MAP[idx - 1], idx, PAGE_MAP.length);
  }

  ws.close();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
