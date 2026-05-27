// 批量高分截图 — 遍历所有 canonical pageId,用 zoom-shot 重新截图覆盖 UI/ 目录
const { zoomShot } = require('./zoom-shot.js');
const fs = require('fs');
const path = require('path');

// 35 个 canonical page ID 与目标目录/文件名
const PAGES = [
  // A 端小程序
  ['A1',  '登录授权页',        '385ef4bfa1924d38a6d2330d980e126e', '01_C端小程序/A1_登录授权.png'],
  ['A2',  '小程序首页',         'b486e10c8a4a469faf15a56b5f4e1b5c', '01_C端小程序/A2_首页.png'],
  ['A3',  '预约日历',           '01dc65c771954136a0c0a1b6f7c33d5a', '01_C端小程序/A3_预约日历.png'],
  ['A4',  '填写预约信息',       '743bd9ee9ab5412fa0fdb9563dae5b42', '01_C端小程序/A4_填写预约信息.png'],
  ['A5',  '预约成功',           '1049651c781f40d29cd7e150dc2741d8', '01_C端小程序/A5_预约成功.png'],
  ['A6',  '我的预约',           '0923e33086cc439ca13e852d2b5cf196', '01_C端小程序/A6_我的预约.png'],
  ['A7',  'AI 智能问答',         '6dbc7615cd444495b07bc41b5e8d840d', '01_C端小程序/A7_AI问答.png'],
  ['A8',  '景区活动列表',       '382911a51422434dab506c40b9b70d59', '01_C端小程序/A8_活动列表.png'],
  ['A9',  '活动详情',           '376979e463134807a1c3b19e4bb28c39', '01_C端小程序/A9_活动详情.png'],
  ['A10', '园区导览地图',       '111db3ed71d54318896806d29de57150', '01_C端小程序/A10_导览地图.png'],
  ['A11', '我的中心',           'abf572fff62047938c9e01f89c5a1447', '01_C端小程序/A11_我的中心.png'],

  // B 端后台管理
  ['B1',  '后台登录',           '6c7fe1084bb246c6aff002c7f1e98f27', '02_后台管理/B1_登录.png'],
  ['B2',  '主框架仪表盘',       '7e3000108add41a5bd1928d7c9a1b019', '02_后台管理/B2_主框架.png'],
  ['B3',  '景区介绍维护',       '498a68a874e1488995014f3ff05717a9', '02_后台管理/B3_景区介绍.png'],
  ['B4',  '活动运营管理',       'c407a6e3745f4b99aaa0491bf01cc988', '02_后台管理/B4_活动运营.png'],
  ['B5',  'AI 知识库',           '3aa9715e7cea46878e9152aeb81d77a5', '02_后台管理/B5_AI知识库.png'],
  ['B6',  '分时预约配额',       'e44f469c83ec4d52b04ed02ffc9d3806', '02_后台管理/B6_配额配置.png'],
  ['B7',  '渠道接入',           'fa833464234e466c94468a1da59e55d8', '02_后台管理/B7_渠道接入.png'],
  ['B8',  '现场补录',           '79e408b4f00f440fb392f77afb43b82e', '02_后台管理/B8_现场补录.png'],
  ['B9',  '爽约风控黑名单',     'f599d3264f0f4299a12ab222b0da4556', '02_后台管理/B9_黑名单.png'],
  ['B10', '实时路况查询',       '3086df6e0b564a989dedd7ce009f4e62', '02_后台管理/B10_路况查询.png'],
  ['B11', '停车场上图',         'e40d7f5f46ae4064ba7e384c3517df61', '02_后台管理/B11_停车场.png'],
  ['B12', '客流分析',           'aaaed96d971f4c6db7cbaeb76910cc5a', '02_后台管理/B12_客流分析.png'],
  ['B13', '热力图分析',         '47c25c1865c242e5a75565c515efd3bf', '02_后台管理/B13_热力图.png'],
  ['B14', '来源分析',           'fc834b50ea944d8bbac89f8848348364', '02_后台管理/B14_来源分析.png'],
  ['B15', '用户画像总览',       'adb3b1e90caf409b866bee907d799fd7', '02_后台管理/B15_用户画像.png'],
  ['B16', 'IoT 设备列表',         'f630bd67784348b5ac0df5893c6af0c6', '02_后台管理/B16_设备列表.png'],
  ['B17', '设备详情',           'f2e3bb326a144d4f895694b67443da79', '02_后台管理/B17_设备详情.png'],

  // C 数据大屏
  ['C1',  '数字大屏主屏',       '233f51791f9d484ab29f7fbf409d46e8', '03_数据大屏/C1_主屏.png'],
  ['C2',  '综合运营面板',       'e54356403c4a4600a3f46cd8278a0640', '03_数据大屏/C2_运营面板.png'],
  ['C3',  '客流预约趋势对比',   '97c21ff5bb2447ccab23bc87f1fdd7b4', '03_数据大屏/C3_客流趋势.png'],
  ['C4',  '预约分时热力图',     'bfe038ecf35942a6891509c6ce2e1cb8', '03_数据大屏/C4_预约热力.png'],
  ['C5',  '景区数据概览首屏',   'bf3b83961f4549b08b2da076c38a25fa', '03_数据大屏/C5_数据概览.png'],
  ['C6',  '数字孪生底座导览图', 'f9b99c191242455a995ee4a04d52f3ae', '03_数据大屏/C6_数字孪生.png'],
  ['C7',  '运营宣传一张图',     '8d973f87b148459288c2282be73631bb', '03_数据大屏/C7_运营宣传.png'],
];

async function main() {
  const UI = path.join(__dirname, '..', 'UI');
  let ok = 0, fail = 0;
  const t0 = Date.now();
  for (let i = 0; i < PAGES.length; i++) {
    const [code, name, dataId, relPath] = PAGES[i];
    const outPath = path.join(UI, relPath);
    try {
      const r = await zoomShot(dataId, outPath);
      if (r.ok) {
        ok++;
        console.log(`[${i+1}/${PAGES.length}] ${code} ${name} → ${(r.bytes/1024).toFixed(0)} KB`);
      } else {
        fail++;
        console.log(`[${i+1}/${PAGES.length}] ${code} ${name} FAILED: ${r.error || r.err}`);
      }
    } catch(e) {
      fail++;
      console.log(`[${i+1}/${PAGES.length}] ${code} ${name} EXCEPTION: ${e.message}`);
    }
  }
  const sec = Math.round((Date.now() - t0) / 1000);
  console.log(`\n=== Done: ${ok} OK, ${fail} FAIL in ${sec}s ===`);
}

main().catch(e => { console.error(e); process.exit(1); });
