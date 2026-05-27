// 高分辨率截图 — 直接改 react-flow viewport transform 把目标节点居中 + scale=1,然后截图
//
// 用法:
//   node scripts/zoom-shot.js <data-id> <out.png>
//
// 原理:
//   react-flow 的 .react-flow__viewport 元素有 CSS transform: translate(X, Y) scale(Z)
//   节点在 canvas 上有自己的 translate(NX, NY) + width/height
//   通过覆写 viewport transform = translate(-NX + paneW/2 - W/2, -NY + paneH/2 - H/2) scale(1),
//   节点就被居中显示在 pane 内,以原始设计像素呈现 → 高分截图

const { CDP_HOST, getCompanionId, getMainPageId, rpc, sleep } = require('./lib.js');
const WebSocket = require('ws');
const fs = require('fs');

async function withWs(targetId, fn) {
  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + targetId);
  await new Promise(r => ws.on('open', r));
  try { return await fn(ws); } finally { ws.close(); }
}

async function zoomShot(dataId, outPath, opts) {
  opts = opts || {};
  const compId = await getCompanionId();
  const mainId = await getMainPageId();

  // 1. 在 iframe 内计算并应用 viewport transform (自适应缩放 fit-to-pane)
  const clip = await withWs(compId, async ws => {
    const expr = `(function(){
      var vp = document.querySelector('.react-flow__viewport');
      var pane = vp.parentElement;
      var n = document.querySelector('[data-id="${dataId}"]');
      if (!vp || !pane || !n) return JSON.stringify({err:'missing'});

      var m = (n.style.transform || '').match(/translate\\(([-\\d.]+)px,\\s*([-\\d.]+)px\\)/);
      if (!m) return JSON.stringify({err:'no node transform'});
      var nx = parseFloat(m[1]), ny = parseFloat(m[2]);
      var nw = parseFloat(n.style.width) || 390, nh = parseFloat(n.style.height) || 884;
      var paneR = pane.getBoundingClientRect();
      var pw = paneR.width, ph = paneR.height;

      // 自适应缩放:让节点完全装入 pane,留 15% 安全边距(防止超出 Stitch UI)
      var padding = 0.85;
      var scale = Math.min((pw * padding) / nw, (ph * padding) / nh);
      // 但不放大超过 1
      scale = Math.min(scale, 1);

      var tx = (pw / 2) - (nx + nw / 2) * scale;
      var ty = (ph / 2) - (ny + nh / 2) * scale;
      vp.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) scale(' + scale + ')';

      // 强制 iframe srcdoc 重载(react-flow 对远距离节点的 iframe 可能丢弃 paint layer)
      var iframe = n.querySelector('iframe');
      if (iframe) {
        var doc = iframe.srcdoc;
        iframe.srcdoc = '';
        iframe.srcdoc = doc;
      }

      // 强制刷新一次(避免 react-flow 立即回写)
      vp.offsetHeight;

      // 计算节点在屏幕坐标系下的 rect(供主页面截图 clip 用)
      var br = n.getBoundingClientRect();
      // iframe 在主页面里的偏移
      var iframeOffsetX = 0, iframeOffsetY = 0;
      try {
        var ifrEl = window.frameElement;
        if (ifrEl) {
          var ir = ifrEl.getBoundingClientRect();
          // 注意:这是 iframe-relative; window.frameElement 给 parent 的偏移
        }
      } catch(e) {}
      return JSON.stringify({
        node_x: br.x, node_y: br.y, node_w: br.width, node_h: br.height,
        pane_w: pw, pane_h: ph
      });
    })()`;
    const r = await rpc(ws, 1, 'Runtime.evaluate', { expression: expr });
    return JSON.parse(r.result.result.value);
  });
  if (clip.err) return { error: clip.err };

  // 2. 等 6s 让 iframe srcdoc 重新加载完成(对内容多/资源重的页面需要)
  await sleep(6000);

  // 3. 主页面 captureScreenshot
  return await withWs(mainId, async ws => {
    const c = {
      x: Math.max(0, Math.round(clip.node_x)),
      y: Math.max(0, Math.round(clip.node_y)),
      width: Math.round(clip.node_w),
      height: Math.round(clip.node_h),
      scale: 1
    };
    const r = await rpc(ws, 1, 'Page.captureScreenshot', { format: 'png', clip: c }, 30000);
    if (!r.result || !r.result.data) return { error: 'no_screenshot', raw: r };
    const buf = Buffer.from(r.result.data, 'base64');
    fs.writeFileSync(outPath, buf);
    return { ok: true, path: outPath, bytes: buf.length, clip: c };
  });
}

module.exports = { zoomShot };

if (require.main === module) {
  const [dataId, out] = process.argv.slice(2);
  if (!dataId || !out) {
    console.error('usage: node scripts/zoom-shot.js <data-id> <out.png>');
    process.exit(1);
  }
  zoomShot(dataId, out).then(r => console.log(JSON.stringify(r))).catch(e => { console.error(e); process.exit(1); });
}
