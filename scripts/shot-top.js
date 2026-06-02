// 截某节点的"顶部 N px"于原始 1:1 比例
const { CDP_HOST, getCompanionId, getMainPageId, rpc, sleep } = require('/home/agent/projects/Panda/Changqiushan/scripts/lib.js');
const WebSocket = require('ws');
const fs = require('fs');

async function withWs(targetId, fn) {
  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + targetId);
  await new Promise(r => ws.on('open', r));
  try { return await fn(ws); } finally { ws.close(); }
}

(async () => {
  const [dataId, out, topPxStr] = process.argv.slice(2);
  const topPx = parseInt(topPxStr || '1200');
  const compId = await getCompanionId();
  const mainId = await getMainPageId();
  const clip = await withWs(compId, async ws => {
    const r = await rpc(ws, 1, 'Runtime.evaluate', { expression: `
      (function(){
        var vp = document.querySelector('.react-flow__viewport');
        var pane = vp.parentElement;
        var n = document.querySelector('[data-id="${dataId}"]');
        if (!vp||!pane||!n) return JSON.stringify({err:'missing'});
        var m = (n.style.transform||'').match(/translate\\(([-\\d.]+)px,\\s*([-\\d.]+)px\\)/);
        var nx = parseFloat(m[1]), ny = parseFloat(m[2]);
        var nw = parseFloat(n.style.width)||1280, nh = parseFloat(n.style.height)||1024;
        var paneR = pane.getBoundingClientRect();
        var pw = paneR.width, ph = paneR.height;
        // 1:1 scale (no zoom)
        var scale = Math.min(0.5, (pw * 0.9) / nw);
        var tx = (pw / 2) - (nx + nw / 2) * scale;
        var ty = 60 - ny * scale;
        vp.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) scale(' + scale + ')';
        var iframe = n.querySelector('iframe');
        if (iframe) { var doc = iframe.srcdoc; iframe.srcdoc=''; iframe.srcdoc=doc; }
        vp.offsetHeight;
        var br = n.getBoundingClientRect();
        return JSON.stringify({ x: br.x, y: br.y, w: br.width, h: Math.min(${topPx}*scale, br.height) });
      })()
    ` });
    return JSON.parse(r.result.result.value);
  });
  if (clip.err) { console.error(clip.err); process.exit(2); }
  await sleep(8000);
  await withWs(mainId, async ws => {
    const c = {
      x: Math.max(0, Math.round(clip.x)),
      y: Math.max(0, Math.round(clip.y)),
      width: Math.round(clip.w),
      height: Math.round(clip.h),
      scale: 1
    };
    const r = await rpc(ws, 1, 'Page.captureScreenshot', { format:'png', clip: c }, 30000);
    fs.writeFileSync(out, Buffer.from(r.result.data, 'base64'));
    console.log(JSON.stringify({ok:true, bytes:fs.statSync(out).size, clip: c}));
  });
})().catch(e => { console.error(e); process.exit(1); });
