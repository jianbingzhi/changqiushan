// 高大节点截图 — fit-to-height,允许内容压缩到 pane 内
const { CDP_HOST, getCompanionId, getMainPageId, rpc, sleep } = require('./lib.js');
const WebSocket = require('ws');
const fs = require('fs');

async function withWs(targetId, fn) {
  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + targetId);
  await new Promise(r => ws.on('open', r));
  try { return await fn(ws); } finally { ws.close(); }
}

async function main() {
  const dataId = process.argv[2];
  const out = process.argv[3];
  if (!dataId || !out) { console.error('usage: node zoom-tall.js <data-id> <out.png>'); process.exit(1); }

  const compId = await getCompanionId();
  const mainId = await getMainPageId();

  const clip = await withWs(compId, async ws => {
    const expr = `(function(){
      var vp = document.querySelector('.react-flow__viewport');
      var pane = vp.parentElement;
      var n = document.querySelector('[data-id="${dataId}"]');
      if (!vp || !pane || !n) return JSON.stringify({err:'missing'});
      var m = (n.style.transform || '').match(/translate\\(([-\\d.]+)px,\\s*([-\\d.]+)px\\)/);
      if (!m) return JSON.stringify({err:'no node transform'});
      var nx = parseFloat(m[1]), ny = parseFloat(m[2]);
      var nw = parseFloat(n.style.width) || 1280, nh = parseFloat(n.style.height) || 2901;
      var paneR = pane.getBoundingClientRect();
      var pw = paneR.width, ph = paneR.height;
      // Stitch chat overlay 占底 ~200px,顶部 toolbar ~60px,把节点压在中间可用区
      var bottomOverlay = 220;
      var topOffset = 60;
      var usableH = ph - bottomOverlay - topOffset;
      var scale = Math.min(usableH / nh, (pw * 0.9) / nw, 1);
      var tx = (pw / 2) - (nx + nw / 2) * scale;
      // 顶端对齐 topOffset 而不是垂直居中,这样底部不会进入 overlay 区
      var ty = topOffset - ny * scale;
      vp.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) scale(' + scale + ')';
      var iframe = n.querySelector('iframe');
      if (iframe) { var doc = iframe.srcdoc; iframe.srcdoc = ''; iframe.srcdoc = doc; }
      vp.offsetHeight;
      var br = n.getBoundingClientRect();
      return JSON.stringify({ node_x: br.x, node_y: br.y, node_w: br.width, node_h: br.height });
    })()`;
    const r = await rpc(ws, 1, 'Runtime.evaluate', { expression: expr });
    return JSON.parse(r.result.result.value);
  });
  if (clip.err) { console.error(clip.err); process.exit(2); }

  await sleep(8000);

  await withWs(mainId, async ws => {
    const c = {
      x: Math.max(0, Math.round(clip.node_x)),
      y: Math.max(0, Math.round(clip.node_y)),
      width: Math.round(clip.node_w),
      height: Math.round(clip.node_h),
      scale: 1
    };
    const r = await rpc(ws, 1, 'Page.captureScreenshot', { format: 'png', clip: c }, 30000);
    fs.writeFileSync(out, Buffer.from(r.result.data, 'base64'));
    console.log(JSON.stringify({ ok: true, bytes: fs.statSync(out).size, clip: c }));
  });
}
main().catch(e => { console.error(e); process.exit(1); });
