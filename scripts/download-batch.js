// 全量下载 — 35 页通过 Stitch Export → zip 拦截 → 解压 → 整理成 <模块>/<标题>.md/.png
//
// 失败的页(Stitch CDN 404)自动 fallback 到现有 UI/ 高分截图 + 占位 DESIGN.md
//
// 用法: node scripts/download-batch.js

const { CDP_HOST, getCompanionId, getMainPageId, rpc, sleep } = require('./lib.js');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const DL_DIR = path.join(ROOT, 'downloads');           // 临时 zip 目录
const UI_DIR = path.join(ROOT, 'UI');                  // 最终产物目录
const FALLBACK_DIR = path.join(ROOT, 'UI_old_shots');  // 旧高分图(zoom-shot 备份)

fs.mkdirSync(DL_DIR, { recursive: true });

// PAGE_MAP: [code, dataId, moduleFolder, pageTitle (用作文件名)]
const PAGES = [
  // A 端小程序
  ['A1',  '385ef4bfa1924d38a6d2330d980e126e', '01_C端小程序', '登录授权页'],
  ['A2',  'b486e10c8a4a469faf15a56b5f4e1b5c', '01_C端小程序', '小程序首页'],
  ['A3',  '01dc65c771954136a0c0a1b6f7c33d5a', '01_C端小程序', '预约日历与时段选择'],
  ['A4',  '743bd9ee9ab5412fa0fdb9563dae5b42', '01_C端小程序', '填写预约信息'],
  ['A5',  '1049651c781f40d29cd7e150dc2741d8', '01_C端小程序', '预约成功与核销码'],
  ['A6',  '0923e33086cc439ca13e852d2b5cf196', '01_C端小程序', '我的预约列表'],
  ['A7',  '6dbc7615cd444495b07bc41b5e8d840d', '01_C端小程序', 'AI 智能问答'],
  ['A8',  '382911a51422434dab506c40b9b70d59', '01_C端小程序', '景区活动列表'],
  ['A9',  '376979e463134807a1c3b19e4bb28c39', '01_C端小程序', '活动详情'],
  ['A10', '111db3ed71d54318896806d29de57150', '01_C端小程序', '园区导览地图'],
  ['A11', 'abf572fff62047938c9e01f89c5a1447', '01_C端小程序', '我的中心'],
  // B 端后台管理
  ['B1',  '6c7fe1084bb246c6aff002c7f1e98f27', '02_后台管理', '后台管理系统登录'],
  ['B2',  '7e3000108add41a5bd1928d7c9a1b019', '02_后台管理', '主框架与仪表盘'],
  ['B3',  '498a68a874e1488995014f3ff05717a9', '02_后台管理', '景区介绍维护'],
  ['B4',  'c407a6e3745f4b99aaa0491bf01cc988', '02_后台管理', '活动运营管理'],
  ['B5',  '3aa9715e7cea46878e9152aeb81d77a5', '02_后台管理', 'AI 问答知识库'],
  ['B6',  'e44f469c83ec4d52b04ed02ffc9d3806', '02_后台管理', '分时预约配额配置'],
  ['B7',  'fa833464234e466c94468a1da59e55d8', '02_后台管理', '渠道预约接入管理'],
  ['B8',  '79e408b4f00f440fb392f77afb43b82e', '02_后台管理', '现场补录面板'],
  ['B9',  'f599d3264f0f4299a12ab222b0da4556', '02_后台管理', '爽约风控与黑名单'],
  ['B10', '3086df6e0b564a989dedd7ce009f4e62', '02_后台管理', '实时路况查询'],
  ['B11', 'e40d7f5f46ae4064ba7e384c3517df61', '02_后台管理', '停车场动静态上图'],
  ['B12', 'aaaed96d971f4c6db7cbaeb76910cc5a', '02_后台管理', '客流分析'],
  ['B13', '47c25c1865c242e5a75565c515efd3bf', '02_后台管理', '热力图分析'],
  ['B14', 'fc834b50ea944d8bbac89f8848348364', '02_后台管理', '来源分析'],
  ['B15', 'adb3b1e90caf409b866bee907d799fd7', '02_后台管理', '用户画像总览'],
  ['B16', 'f630bd67784348b5ac0df5893c6af0c6', '02_后台管理', '物联网设备实时列表'],
  ['B17', 'f2e3bb326a144d4f895694b67443da79', '02_后台管理', '设备详情与心跳监测'],
  // C 数据大屏
  ['C1',  '233f51791f9d484ab29f7fbf409d46e8', '03_数据大屏', '数字大屏主屏'],
  ['C2',  'e54356403c4a4600a3f46cd8278a0640', '03_数据大屏', '综合运营态势面板'],
  ['C3',  '97c21ff5bb2447ccab23bc87f1fdd7b4', '03_数据大屏', '客流与预约趋势对比'],
  ['C4',  'bfe038ecf35942a6891509c6ce2e1cb8', '03_数据大屏', '预约分时热力图'],
  ['C5',  'bf3b83961f4549b08b2da076c38a25fa', '03_数据大屏', '景区数据概览首屏'],
  ['C6',  'f9b99c191242455a995ee4a04d52f3ae', '03_数据大屏', '数字孪生底座导览图'],
  ['C7',  '8d973f87b148459288c2282be73631bb', '03_数据大屏', '运营宣传一张图'],
];

function ts() { return new Date().toISOString().slice(11, 23); }
function log(msg) { console.log(`[${ts()}] ${msg}`); }
function safeName(s) { return s.replace(/[\\/:*?"<>|]/g, '_'); }

// 简易 zip 解析器(不依赖 unzip 命令)— 只读 stored / deflate
function extractZip(buf) {
  const files = {};
  // 找 central directory(EOCD)
  let p = buf.length - 22;
  while (p > 0 && buf.readUInt32LE(p) !== 0x06054b50) p--;
  if (p < 0) throw new Error('no EOCD');
  const cdSize = buf.readUInt32LE(p + 12);
  const cdOffset = buf.readUInt32LE(p + 16);
  // 遍历 central directory
  let cp = cdOffset;
  while (cp < cdOffset + cdSize) {
    if (buf.readUInt32LE(cp) !== 0x02014b50) break;
    const compMethod = buf.readUInt16LE(cp + 10);
    const compSize = buf.readUInt32LE(cp + 20);
    const nameLen = buf.readUInt16LE(cp + 28);
    const extraLen = buf.readUInt16LE(cp + 30);
    const commentLen = buf.readUInt16LE(cp + 32);
    const localHeaderOffset = buf.readUInt32LE(cp + 42);
    const name = buf.toString('utf8', cp + 46, cp + 46 + nameLen);
    // 读 local header 获取数据起点
    const lh = localHeaderOffset;
    const lhNameLen = buf.readUInt16LE(lh + 26);
    const lhExtraLen = buf.readUInt16LE(lh + 28);
    const dataStart = lh + 30 + lhNameLen + lhExtraLen;
    const data = buf.slice(dataStart, dataStart + compSize);
    let out;
    if (compMethod === 0) out = data;
    else if (compMethod === 8) out = zlib.inflateRawSync(data);
    else throw new Error('unsupported method ' + compMethod);
    files[name] = out;
    cp += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function generateDesignMd(code, title, moduleFolder, fallbackReason) {
  const promptFile = path.join(ROOT, 'prompts', `${code}-*.txt`);
  let promptText = '';
  // 找 prompts 目录里以 code- 开头的文件
  const promptDir = path.join(ROOT, 'prompts');
  if (fs.existsSync(promptDir)) {
    const files = fs.readdirSync(promptDir);
    const main = files.find(f => f.startsWith(code + '-') && !/-fix-/.test(f));
    if (main) promptText = fs.readFileSync(path.join(promptDir, main), 'utf-8');
  }
  return `---
name: ${title}
code: ${code}
module: ${moduleFolder}
source: ${fallbackReason}
generated: ${new Date().toISOString()}
---

# ${title}

> ${fallbackReason}

## 设计提示词(交付给 Stitch AI 的源)

${promptText || '(未找到对应 prompt 文件)'}

## 设计系统色板(项目级)

- 主色 \`#2D5A27\`(深森林绿)
- 次色 \`#8B5E34\`(山棕)
- 点缀 \`#6B8E23\`(橄榄绿)
- 警示橙 \`#D97706\`
- 失败红 \`#DC2626\`
- 成功绿 \`#059669\`
- 背景米白 \`#F5F2EA\` / 卡片白 \`#FFFFFF\`
- 大屏深底 \`#0A1F0A\`(深森林墨绿)+ 辉光 \`#4A8E3F\`

详细设计规范见 \`docs/长秋山V2.txt\`(PRD 修正版)。
`;
}

let cws, mws, capturedBlobs = [];

async function setupSession() {
  const compId = await getCompanionId();
  const mainId = await getMainPageId();
  cws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + compId);
  await new Promise(r => cws.on('open', r));
  mws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + mainId);
  await new Promise(r => mws.on('open', r));

  // 注入 blob hook(一次)
  await rpc(cws, 1, 'Runtime.evaluate', {
    expression: `(function(){
      window.__cdp_captured_blobs = [];
      if (window.__cdp_blob_hook) return 'rearmed';
      window.__cdp_blob_hook = true;
      var orig = URL.createObjectURL.bind(URL);
      URL.createObjectURL = function(blob) {
        var u = orig(blob);
        if (blob && blob.size > 500) {
          var reader = new FileReader();
          reader.onload = function() {
            var b64 = (reader.result||'').split(',')[1] || '';
            window.__cdp_captured_blobs.push({size: blob.size, type: blob.type, url: u, base64: b64, ts: Date.now()});
          };
          reader.readAsDataURL(blob);
        }
        return u;
      };
      return 'hooked';
    })()`
  });
}

async function downloadOne(code, dataId, title) {
  // 清 blob 缓冲
  await rpc(cws, 100, 'Runtime.evaluate', { expression: 'window.__cdp_captured_blobs = [];' });

  // Step 1: pan canvas to node + select
  const panRes = await rpc(cws, 110, 'Runtime.evaluate', {
    expression: `(function(){
      var vp = document.querySelector('.react-flow__viewport');
      var n = document.querySelector('[data-id="${dataId}"]');
      if (!n) return JSON.stringify({err:'no node'});
      var m = (n.style.transform||'').match(/translate\\(([-\\d.]+)px,\\s*([-\\d.]+)px\\)/);
      if (!m) return JSON.stringify({err:'no transform'});
      var nx=parseFloat(m[1]), ny=parseFloat(m[2]);
      var nw=parseFloat(n.style.width)||390, nh=parseFloat(n.style.height)||884;
      var pr=vp.parentElement.getBoundingClientRect();
      var scale = 1;
      var tx = pr.width/2 - (nx+nw/2)*scale, ty = pr.height/2 - (ny+nh/2)*scale;
      vp.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) scale(' + scale + ')';
      var br = n.getBoundingClientRect();
      return JSON.stringify({cx: Math.round(br.x+br.width/2), cy: Math.round(br.y+br.height/2)});
    })()`
  });
  const pan = JSON.parse(panRes.result.result.value);
  if (pan.err) throw new Error('pan failed: ' + pan.err);

  // 点击节点
  await rpc(cws, 120, 'Input.dispatchMouseEvent', {type:'mousePressed', x: pan.cx, y: pan.cy, button:'left', clickCount:1});
  await rpc(cws, 121, 'Input.dispatchMouseEvent', {type:'mouseReleased', x: pan.cx, y: pan.cy, button:'left', clickCount:1});
  await sleep(1500);

  // 关闭可能开着的 export 面板(ESC)
  await rpc(cws, 122, 'Input.dispatchKeyEvent', {type:'keyDown', key:'Escape', code:'Escape'});
  await rpc(cws, 123, 'Input.dispatchKeyEvent', {type:'keyUp', key:'Escape', code:'Escape'});
  await sleep(300);

  // Step 2: 点击 Export
  await rpc(cws, 130, 'Input.dispatchMouseEvent', {type:'mousePressed', x:1490, y:36, button:'left', clickCount:1});
  await rpc(cws, 131, 'Input.dispatchMouseEvent', {type:'mouseReleased', x:1490, y:36, button:'left', clickCount:1});
  await sleep(1800);

  // Step 3: 点击 .zip radio
  await rpc(cws, 140, 'Input.dispatchMouseEvent', {type:'mousePressed', x:1386, y:455, button:'left', clickCount:1});
  await rpc(cws, 141, 'Input.dispatchMouseEvent', {type:'mouseReleased', x:1386, y:455, button:'left', clickCount:1});
  await sleep(800);

  // Step 4: 点击 Confirm Export(底部按钮)
  await rpc(cws, 150, 'Input.dispatchMouseEvent', {type:'mousePressed', x:1495, y:717, button:'left', clickCount:1});
  await rpc(cws, 151, 'Input.dispatchMouseEvent', {type:'mouseReleased', x:1495, y:717, button:'left', clickCount:1});

  // Step 5: 轮询 blob 捕获(最多 20s)
  let blob = null;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const r = await rpc(cws, 160 + i, 'Runtime.evaluate', {
      expression: 'JSON.stringify((window.__cdp_captured_blobs||[]).map(function(b){return {size:b.size, type:b.type, base64:b.base64};}))'
    });
    const blobs = JSON.parse(r.result.result.value);
    if (blobs.length > 0 && blobs[0].base64) {
      blob = blobs[0];
      break;
    }
  }
  if (!blob) throw new Error('no blob captured in 20s');
  return Buffer.from(blob.base64, 'base64');
}

async function main() {
  // 备份旧 UI 截图
  if (fs.existsSync(UI_DIR) && !fs.existsSync(FALLBACK_DIR)) {
    log(`Backing up old UI/ → ${FALLBACK_DIR}`);
    fs.cpSync(UI_DIR, FALLBACK_DIR, { recursive: true });
  }

  // 准备最终输出目录(模块子文件夹)
  const modules = [...new Set(PAGES.map(p => p[2]))];
  for (const m of modules) fs.mkdirSync(path.join(UI_DIR, m), { recursive: true });

  log(`╔═══════════════════════════════════════════════════════════╗`);
  log(`║ Stitch 全量下载 (${PAGES.length} 页) — Export → zip → 整理`.padEnd(64) + `║`);
  log(`║ 输出: <UI>/<模块>/<页面标题>.{md,png}`.padEnd(64) + `║`);
  log(`║ 失败 fallback: 用 ${path.basename(FALLBACK_DIR)}/ 旧高分图 + prompt-based DESIGN.md`.padEnd(67) + `║`);
  log(`╚═══════════════════════════════════════════════════════════╝`);

  await setupSession();
  log(`✓ CDP 会话就绪 (companion + main WS + URL.createObjectURL hook)`);

  const results = [];
  const t0 = Date.now();

  for (let i = 0; i < PAGES.length; i++) {
    const [code, dataId, mod, title] = PAGES[i];
    const sfx = `[${(i+1).toString().padStart(2,'0')}/${PAGES.length}]`;
    log(`\n${sfx} ${code} · ${mod} · ${title}`);

    const outDir = path.join(UI_DIR, mod);
    const pngPath = path.join(outDir, safeName(title) + '.png');
    const mdPath = path.join(outDir, safeName(title) + '.md');

    let success = false, reason = '';
    try {
      const zipBuf = await downloadOne(code, dataId, title);
      // 保存 zip 到 temp
      const zipPath = path.join(DL_DIR, `${code}_${safeName(title)}.zip`);
      fs.writeFileSync(zipPath, zipBuf);
      log(`  📦 zip ${(zipBuf.length/1024).toFixed(0)} KB`);

      // 解压
      const files = extractZip(zipBuf);
      const screen = files['screen.png'];
      const design = files['DESIGN.md'];

      if (screen && screen.length > 1000) {
        fs.writeFileSync(pngPath, screen);
        // DESIGN.md 增强 — 加 page-level header
        const designContent = (design ? design.toString('utf-8') : '') +
          `\n\n## 页面元信息\n\n- 代号: ${code}\n- 标题: ${title}\n- 模块: ${mod}\n- 节点 ID: \`${dataId}\`\n- 来源: Stitch 原生 Export (.zip)\n- 生成时间: ${new Date().toISOString()}\n`;
        fs.writeFileSync(mdPath, designContent);
        log(`  ✓ saved ${safeName(title)}.png (${(screen.length/1024).toFixed(0)} KB) + .md`);
        success = true; reason = 'stitch_export';
      } else {
        const txt = screen ? screen.toString('utf-8', 0, Math.min(50, screen.length)) : '(no screen.png in zip)';
        throw new Error('invalid screen.png (' + (screen ? screen.length : 0) + ' bytes): ' + txt);
      }
    } catch(e) {
      log(`  ✗ Stitch export failed: ${e.message}`);
      // Fallback: 用旧高分图 + 生成 prompt-based DESIGN.md
      const oldSrcDir = path.join(FALLBACK_DIR, mod);
      // 在旧目录里按 code 前缀找
      const oldFiles = fs.existsSync(oldSrcDir) ? fs.readdirSync(oldSrcDir) : [];
      const oldPng = oldFiles.find(f => f.startsWith(code + '_') && f.endsWith('.png'));
      if (oldPng) {
        fs.copyFileSync(path.join(oldSrcDir, oldPng), pngPath);
        log(`  📋 fallback PNG ← ${oldPng}`);
      } else {
        log(`  ⚠ no fallback PNG found in ${oldSrcDir}`);
      }
      const designMd = generateDesignMd(code, title, mod, 'Stitch Export 失败(CDN 404),已 fallback 到 CDP 高分截图,本 DESIGN.md 基于 Stitch 原始 prompt 生成');
      fs.writeFileSync(mdPath, designMd);
      reason = 'fallback';
    }

    results.push({code, title, mod, success, reason, pngPath, mdPath});
  }

  // 汇总
  const sec = Math.round((Date.now() - t0) / 1000);
  const ok = results.filter(r => r.success).length;
  const fb = results.filter(r => !r.success).length;
  log(`\n╔═══════════════════════════════════════════════════════════╗`);
  log(`║ 完成: ${ok} 原生 Export · ${fb} fallback · 共 ${results.length} 页 / ${sec}s`.padEnd(64) + `║`);
  log(`╚═══════════════════════════════════════════════════════════╝`);
  if (fb > 0) {
    log(`Fallback 页(Stitch CDN 404):`);
    results.filter(r => !r.success).forEach(r => log(`   - ${r.code} · ${r.title}`));
  }

  fs.writeFileSync(path.join(ROOT, 'logs', 'download-batch-result.json'), JSON.stringify(results, null, 2));
  log(`Result saved to logs/download-batch-result.json`);

  cws.close(); mws.close();
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
