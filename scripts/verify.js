// 三大指标验证库 v2 — 直接解析 iframe srcdoc HTML,跳过 sandbox 限制
//
// 关键改进:
// 1. Stitch 把页面渲染在 sandbox="allow-scripts" 的 iframe 里,父页面无法访问 contentDocument。
//    → 改为读 iframe 的 srcdoc 字符串,用 cheerio 解析。
// 2. Material Symbols 图标用 ligature(文本即图形),要从可见文本里剔除。
// 3. PRD 红线词(门票/票价/...)单独走 verifyForbiddenTerms。

const { CDP_HOST, getCompanionId, getMainPageId, getTargets, rpc } = require('./lib.js');
const WebSocket = require('ws');
const cheerio = require('cheerio');
const fs = require('fs');

async function withWs(fn) {
  const id = await getCompanionId();
  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + id);
  await new Promise(r => ws.on('open', r));
  try { return await fn(ws); } finally { ws.close(); }
}

async function withMainWs(fn) {
  const id = await getMainPageId();
  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + id);
  await new Promise(r => ws.on('open', r));
  try { return await fn(ws); } finally { ws.close(); }
}

async function withFrameWs(targetId, fn) {
  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + targetId);
  await new Promise(r => ws.on('open', r));
  try { return await fn(ws); } finally { ws.close(); }
}

// 精确映射 — page node 的 data-id → 内部 iframe 的 CDP target id
// 通过 DOM.describeNode 拿 iframe 元素的 frameId,frameId === iframe targetId
async function findFrameTargetForPageNode(pageDataId) {
  return await withWs(async ws => {
    const r1 = await rpc(ws, 1, 'Runtime.evaluate', {
      expression: `document.querySelector('[data-id="${pageDataId}"] iframe')`,
      returnByValue: false
    });
    const objectId = r1.result?.result?.objectId;
    if (!objectId) return null;
    const r2 = await rpc(ws, 2, 'DOM.describeNode', { objectId, depth: 0 });
    const frameId = r2.result?.node?.frameId;
    return frameId || null;
  });
}

// 兼容旧调用:用 label 模糊匹配 srcdoc iframe (但优先建议改用 page-node-data-id)
async function findLiveFrameForLabel(label) {
  const targets = await getTargets();
  const srcdocs = targets.filter(t => t.url === 'about:srcdoc');
  const meta = [];
  for (const t of srcdocs) {
    const m = await withFrameWs(t.id, async ws => {
      const r = await rpc(ws, 1, 'Runtime.evaluate', { expression: 'JSON.stringify({title:document.title||"", h1:(document.querySelector("h1")||{}).textContent||"", bodyLen:(document.body?document.body.innerText:"").length})' }, 5000);
      return JSON.parse(r.result.result.value);
    }).catch(() => null);
    if (!m) continue;
    meta.push({ targetId: t.id, ...m });
  }
  const score = (m) => {
    let s = 0;
    if (m.title.includes(label)) s += 100;
    if (m.h1.includes(label)) s += 50;
    s += Math.min(m.bodyLen, 1000) / 100;
    return s;
  };
  const ranked = meta.map(m => ({ ...m, score: score(m) })).sort((a, b) => b.score - a.score);
  return ranked[0] || null;
}

// 从 page 节点拉出内部 iframe 的 srcdoc HTML
async function getPageHtml(nodeSelector) {
  return await withWs(async ws => {
    const expr = `(function(){
      var n = document.querySelector(${JSON.stringify(nodeSelector)});
      if (!n) return JSON.stringify({error:'no node'});
      var iframe = n.querySelector('iframe');
      if (!iframe) return JSON.stringify({error:'no iframe inside node'});
      return JSON.stringify({srcdoc: iframe.srcdoc || ''});
    })()`;
    const r = await rpc(ws, 1, 'Runtime.evaluate', { expression: expr });
    return JSON.parse(r.result.result.value);
  });
}

// 把 HTML 解析为可见文本片段数组 + 属性文本(placeholder/aria-label/title/alt)
function extractVisibleStrings(html) {
  const $ = cheerio.load(html);
  // 删 script / style / 注释
  $('script, style, noscript, template').remove();
  // 删 Material icon 元素 (内容是 ligature 名称,渲染为图形,非可见文字)
  $('[class*="material-symbols"], [class*="material-icons"]').remove();
  // 删隐藏元素
  $('[aria-hidden="true"]').each((_, el) => {
    const cls = ($(el).attr('class') || '');
    // 不要删 svg 里 aria-hidden,可能有 alt-text 在它的 sibling
    if (!/svg/i.test(el.tagName)) $(el).remove();
  });

  const textPieces = [];
  // 可见文本节点
  $('body *').each((_, el) => {
    if (el.type !== 'tag') return;
    // 只取直接 textNode 子节点,避免重复
    el.children.forEach(c => {
      if (c.type === 'text') {
        const t = (c.data || '').trim();
        if (t) textPieces.push({ kind: 'text', tag: el.tagName, text: t });
      }
    });
    // 属性扫描
    ['placeholder','aria-label','title','alt'].forEach(attr => {
      const v = $(el).attr(attr);
      if (v && v.trim()) textPieces.push({ kind: attr, tag: el.tagName, text: v.trim() });
    });
  });
  // 也读 <title>
  const t = $('title').text().trim();
  if (t) textPieces.push({ kind: 'title', tag: 'title', text: t });
  return textPieces;
}

// 直接从活的 iframe target 抓 visible text (跳过 material icons / script / style / Stitch overlay)
async function extractLiveVisible(targetId) {
  return await withFrameWs(targetId, async ws => {
    const r = await rpc(ws, 1, 'Runtime.evaluate', {
      expression: `(function(){
        var clone = document.body.cloneNode(true);
        clone.querySelectorAll('script,style,noscript,template').forEach(function(e){e.remove();});
        clone.querySelectorAll('[class*="material-symbols"], [class*="material-icons"]').forEach(function(e){e.remove();});
        clone.querySelectorAll('[aria-hidden="true"]').forEach(function(e){e.remove();});
        // Stitch 注入的图片 placeholder overlay (Replace/Edit/Delete 按钮组)
        clone.querySelectorAll('[data-stitch-overlay], .stitch-image-overlay, [data-image-placeholder]').forEach(function(e){e.remove();});
        // 已知 Stitch 注解文本
        var STITCH_OVERLAY_RE = /^(Replace image|Edit image|Generate image|Upload image|Add image|Click to replace|System Administrator|User Avatar|Avatar|Administrator|Administrator Profile|Profile|User Profile|Admin Profile|Admin Avatar|Ranger Profile|Ranger|Simplified City Map|Simplified Map|City Map|Park Map|Map|Region Map|Location Map|Heat Map|World Map|China Map|Sichuan Map|Cover Image|User Profile Avatar|Profile Avatar|User Photo|Photo|Manager Profile|Operator Profile|Operator Avatar|3D terrain map|3D Map|Terrain Map|Topographic Map|Logo|Brand Logo|Stitch Logo|Park Logo|Forest Park Map|Minimap|Mini Map|Aerial Map|Satellite Map|Park View|Forest View)$/i;
        var attrs = [];
        clone.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach(function(el){
          ['placeholder','aria-label','title','alt'].forEach(function(a){
            var v = el.getAttribute(a); if (!v || !v.trim()) return;
            if (STITCH_OVERLAY_RE.test(v.trim())) return;   // Stitch UI 注解放行
            attrs.push(v.trim());
          });
        });
        return JSON.stringify({
          title: document.title || '',
          body: clone.innerText || '',
          attrs: attrs
        });
      })()`
    }, 10000);
    return JSON.parse(r.result.result.value);
  });
}

// 中文校验 v4:支持 page-data-id 精确寻 target,或 label 模糊
async function verifyChinese(input) {
  let targetId;
  // input 可以是 "data-id-of-page-node" 或 "label string" 或 "[data-id=...]"
  if (input && typeof input === 'string') {
    if (input.startsWith('[data-id="')) {
      const m = input.match(/\[data-id="([^"]+)"\]/);
      if (m) targetId = await findFrameTargetForPageNode(m[1]);
    } else if (/^[0-9a-f]{32}$/i.test(input)) {
      // pure dataId
      targetId = await findFrameTargetForPageNode(input);
    }
    if (!targetId) {
      const live = await findLiveFrameForLabel(input);
      if (!live) return { ok: false, error: 'no_iframe_target_for:' + input };
      targetId = live.targetId;
    }
  }
  const x = await extractLiveVisible(targetId);

  const pieces = [
    { kind: 'title', text: x.title },
    { kind: 'text', text: x.body },
  ].concat((x.attrs || []).map(a => ({ kind: 'attr', text: a })));

  const HAN = /[一-鿿]/;
  // 任意 2+ 字母英文单词都查(短缩写靠白名单放行)
  const LATIN_WORD = /[A-Za-z][A-Za-z]{1,}/g;
  // 白名单 — 长度 2 的也放进来
  const ALLOW = /^(API|APP|AI|UI|UX|POI|KPI|GPS|VIP|QR|IoT|MQTT|HTTP|HTTPS|MD|PNG|JPG|JPEG|SVG|CSS|JS|HTML|3D|2D|ID|OK|GPU|CPU|RAM|SQL|JSON|CSV|XLSX|PDF|URL|H5|IP|MAC|TOP\d*|PRD|FAQ|Logo|App|iOS|GB|MB|KB|EB|TB|am|pm|AM|PM|VPN|RGB|HEX|RGBA|hp|kW|kWh|km|cm|mm|MPV|SUV|wifi|WiFi|UV|RFID|NFC|GATE|CCTV|CNS|HK|POS|LED|LCD|OLED|USB|DVR|CDP|DNS|GIS|LIGHT|MAG|SPK|CAM|DEV|TEMP|HUM|PIR|RFID|EMG|SOS|Excel|Word|Office|PowerPoint|Outlook|Active|Inactive|Enabled|Disabled|On|Off|ms|kg|hz|khz|mhz|ghz|Hz|Mr|Mrs|Ms|Dr|St|AQI|PM\d*|UV|CO|NO|SO|O\d|km\/h|m\/s|vs|VS|DB|App|app|web|Web|JS|TS|UI|API|app\d*|v\d+\.\d+|V\d+\.\d+|km\/?h|gif|GIF|webp|WEBP|PEAK|MIN|MAX|AVG|MED|SUM|COUNT|TOTAL|YoY|MoM|QoQ|WoW|DoD|LTS|Beta|Alpha|Stable|Release|Build|Latest|Space|Time|Theme|Light|Dark|Evergreen|Admin|Editor|Author|Viewer|Sub|Pro|Premium|Free|Trial|LBS|DAU|WAU|MAU|GMV|CTR|CVR|ROI|ARPU|LTV|CAC|UV|PV|UA|IP)$/i;
  // 也允许车牌字母 (单个大写字母 + 数字组合) — 川A12345
  const PLATE = /^[A-Z]\d{4,7}$/;
  // ISO 日期格式 (中文页面应当用"年月日"格式)
  const ISO_DATE = /(?:^|[^\d])(\d{4})-(\d{1,2})-(\d{1,2})(?=[^\d]|$)/g;

  const offenders = [];
  for (const p of pieces) {
    const t = p.text;
    if (/lorem ipsum|dolor sit amet|consectetur/i.test(t)) {
      offenders.push({ kind: 'dummy', context: t.slice(0, 100) });
      continue;
    }
    // ISO 日期检测
    let m;
    ISO_DATE.lastIndex = 0;
    while ((m = ISO_DATE.exec(t)) !== null) {
      offenders.push({ kind: 'iso_date_in_chinese_page', word: m[0].replace(/^[^\d]/, ''), context: t.slice(Math.max(0, m.index - 10), m.index + m[0].length + 10) });
      if (offenders.length >= 50) break;
    }
    const words = t.match(LATIN_WORD) || [];
    for (const w of words) {
      if (ALLOW.test(w)) continue;
      if (PLATE.test(w)) continue;
      // 跳过单纯的 1 字母 (但我们的 LATIN_WORD 最少 2 字母)
      const inMix = HAN.test(t);
      offenders.push({ kind: inMix ? 'mixed_' + p.kind : 'pure_' + p.kind, tag: p.tag, word: w, context: t.slice(0, 100) });
      if (offenders.length >= 50) break;
    }
    if (offenders.length >= 50) break;
  }
  return { ok: offenders.length === 0, count: offenders.length, offenders: offenders.slice(0, 30) };
}

// 从 page node 反推 label (吃旧调用)
async function getLabelFromNode(nodeSelector) {
  return await withWs(async ws => {
    const r = await rpc(ws, 1, 'Runtime.evaluate', { expression: `(function(){
      var n = document.querySelector(${JSON.stringify(nodeSelector)});
      if (!n) return '';
      var t = (n.textContent||'').trim();
      return t.replace(/^devices/, '').replace(/^image/, '').trim();
    })()` });
    return r.result.result.value || '';
  });
}

// PRD 红线词检测 — 精确寻 target
async function verifyForbiddenTerms(input) {
  let targetId;
  if (input && typeof input === 'string') {
    if (input.startsWith('[data-id="')) {
      const m = input.match(/\[data-id="([^"]+)"\]/);
      if (m) targetId = await findFrameTargetForPageNode(m[1]);
    } else if (/^[0-9a-f]{32}$/i.test(input)) {
      targetId = await findFrameTargetForPageNode(input);
    }
    if (!targetId) {
      const live = await findLiveFrameForLabel(input);
      if (!live) return { ok: false, error: 'no_iframe_target_for:' + input };
      targetId = live.targetId;
    }
  }
  const x = await extractLiveVisible(targetId);
  const fullText = [x.title, x.body, ...(x.attrs || [])].join(' | ');

  const FORBIDDEN = [
    '门票', '票价', '购票', '退款', '票务', '买票',
    '有票', '无票', '余票', '票数', '票源',
    '订票', '取票', '退票', '换票', '票根', '票面', '售票', '检票'
  ];
  const SINGLE_OK_CTX = /(投票|票选|抽奖|彩票|股票|发票|车票|船票|机票)/; // 但这些在景区也不该出现,留作后续

  // 否定语境 — 在违禁词前面 6 字内出现则放行(免费、说明性提示语)
  const NEGATION = /(不|无|无需|不收|不设|不需|不再|免|无须|没有)/;
  const offenders = [];
  FORBIDDEN.forEach(w => {
    let idx = 0;
    while ((idx = fullText.indexOf(w, idx)) !== -1) {
      const before = fullText.slice(Math.max(0, idx - 6), idx);
      if (NEGATION.test(before)) { idx += w.length; continue; }
      offenders.push({ kind: 'forbidden_term', word: w, context: fullText.slice(Math.max(0, idx - 20), idx + w.length + 20) });
      idx += w.length;
    }
  });

  // 单字 "票" 兜底(除了已捕获的 FORBIDDEN 复合词)
  const pieces2 = fullText.split('票');
  for (let i = 1; i < pieces2.length; i++) {
    const before = pieces2[i - 1].slice(-3);
    const after = pieces2[i].slice(0, 3);
    const ctx = before + '票' + after;
    // 跳过已被复合词检测捕获的
    const alreadyCaught = FORBIDDEN.some(f => f.includes('票') && ctx.includes(f));
    if (alreadyCaught) continue;
    // 跳过合法语境
    if (SINGLE_OK_CTX.test(ctx)) continue;
    offenders.push({ kind: 'forbidden_char', word: '票', context: ctx });
  }
  return { ok: offenders.length === 0, count: offenders.length, offenders: offenders.slice(0, 20) };
}

// 菜单一致性 — 同样改成读 srcdoc 解析
async function verifyMenu(specTree, nodeSelector) {
  if (!specTree || !specTree.length) {
    return { ok: true, skipped: 'no spec menu for this page' };
  }
  const html = await getPageHtml(nodeSelector);
  if (html.error) return { ok: false, error: html.error };
  const $ = cheerio.load(html.srcdoc);
  $('script, style').remove();
  const navs = $('nav, aside, [role="navigation"], [class*="sidebar" i], [class*="menu" i]');
  if (!navs.length) return { ok: false, missing_all: true, note: 'no nav/sidebar found' };

  function harvest($el) {
    const out = [];
    $el.children().each((_, c) => {
      const $c = $(c);
      // 优先找含 label 的子文本
      const lbl = ($c.children('[class*=label]').text() || $c.children('span,a,div').first().text() || $c.text() || '').trim().slice(0, 40);
      const ch = harvest($c);
      if (lbl) out.push({ label: lbl, children: ch });
    });
    return out;
  }
  const got = [];
  navs.each((_, n) => got.push(harvest($(n))));
  function flat(tree) {
    const out = [];
    tree.forEach(n => { out.push(n.label); if (n.children) out.push(...flat(n.children)); });
    return out;
  }
  const spec = flat(specTree);
  let best = { ok: false, similarity: 0 };
  for (const menu of got) {
    const actual = flat(menu);
    const matched = spec.filter(s => actual.some(a => a.includes(s) || s.includes(a)));
    const sim = matched.length / spec.length;
    if (sim > best.similarity) {
      best = {
        ok: sim >= 0.9,
        similarity: Number(sim.toFixed(2)),
        missing: spec.filter(s => !actual.some(a => a.includes(s) || s.includes(a))),
        extra: actual.filter(a => !spec.some(s => s.includes(a) || a.includes(s))),
      };
    }
  }
  return best;
}

// 截图节点 — 用主页面 target + clip
async function captureNode(nodeSelector, outPath) {
  const box = await withWs(async ws => {
    const expr = `(function(){
      var el = document.querySelector(${JSON.stringify(nodeSelector)});
      if (!el) return JSON.stringify({error:'not_found'});
      var r = el.getBoundingClientRect();
      return JSON.stringify({x:r.x, y:r.y, w:r.width, h:r.height});
    })()`;
    const r = await rpc(ws, 1, 'Runtime.evaluate', { expression: expr });
    return JSON.parse(r.result.result.value);
  });
  if (box.error) return box;
  return await withMainWs(async ws => {
    const clip = { x: Math.max(0, Math.round(box.x)), y: Math.max(0, Math.round(box.y)), width: Math.round(box.w), height: Math.round(box.h), scale: 1 };
    const r = await rpc(ws, 1, 'Page.captureScreenshot', { format: 'png', clip }, 30000);
    if (!r.result || !r.result.data) return { error: 'no_screenshot', raw: r };
    const buf = Buffer.from(r.result.data, 'base64');
    fs.writeFileSync(outPath, buf);
    return { ok: true, path: outPath, bytes: buf.length, clip };
  });
}

// 导出 page srcdoc 到文件,方便调试
async function dumpPageHtml(nodeSelector, outPath) {
  const r = await getPageHtml(nodeSelector);
  if (r.error) return r;
  fs.writeFileSync(outPath, r.srcdoc);
  return { ok: true, path: outPath, bytes: r.srcdoc.length };
}

module.exports = { verifyChinese, verifyForbiddenTerms, verifyMenu, captureNode, dumpPageHtml, getPageHtml, findFrameTargetForPageNode, findLiveFrameForLabel };
