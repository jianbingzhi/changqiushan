// 强制 iframe 重渲染 + 1:1 scale 截图(只截顶部 N px)
// 用法: node scripts/shot-fresh.js <dataId> <out.png> [topPx]
const { CDP_HOST, getCompanionId, getMainPageId, rpc, sleep } = require('./lib.js');
const WebSocket = require('ws');
const fs = require('fs');

async function withWs(targetId, fn) {
  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + targetId);
  await new Promise(r => ws.on('open', r));
  try { return await fn(ws); } finally { ws.close(); }
}

(async () => {
  const [dataId, out, topPxStr] = process.argv.slice(2);
  const topPx = parseInt(topPxStr || '1500', 10);
  const compId = await getCompanionId();
  const mainId = await getMainPageId();

  // 强制 srcdoc 重载并设 viewport,iframe 内置 nh 用 topPx
  const clip = await withWs(compId, async ws => {
    const r = await rpc(ws, 1, 'Runtime.evaluate', { expression: `
      (function(){
        var vp = document.querySelector('.react-flow__viewport');
        var pane = vp.parentElement;
        var n = document.querySelector('[data-id="${dataId}"]');
        if (!vp||!pane||!n) return JSON.stringify({err:'missing'});
        // 暂时 hack node height 为 topPx,让它能 fit 进 pane
        var origH = n.style.height;
        n.style.height = ${topPx} + 'px';
        var iframe = n.querySelector('iframe');
        if (iframe) iframe.style.height = ${topPx} + 'px';

        var m = (n.style.transform||'').match(/translate\\(([-\\d.]+)px,\\s*([-\\d.]+)px\\)/);
        var nx = parseFloat(m[1]), ny = parseFloat(m[2]);
        var nw = parseFloat(n.style.width)||1280, nh = ${topPx};
        var paneR = pane.getBoundingClientRect();
        var pw = paneR.width, ph = paneR.height;
        var padding = 0.85;
        var scale = Math.min((pw*padding)/nw, (ph*padding)/nh, 1);
        var tx = (pw/2) - (nx + nw/2) * scale;
        var ty = (ph/2) - (ny + nh/2) * scale;
        vp.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) scale(' + scale + ')';
        // 强制重载 srcdoc
        if (iframe) { var doc = iframe.srcdoc; iframe.srcdoc=''; iframe.srcdoc=doc; }
        vp.offsetHeight;
        var br = n.getBoundingClientRect();
        return JSON.stringify({x:br.x,y:br.y,w:br.width,h:br.height,origH:origH});
      })()
    ` });
    return JSON.parse(r.result.result.value);
  });
  if (clip.err) { console.error(clip.err); process.exit(2); }

  // 等 iframe 完全渲染
  await sleep(10000);

  // 截图
  await withWs(mainId, async ws => {
    const c = {
      x: Math.max(0, Math.round(clip.x)),
      y: Math.max(0, Math.round(clip.y)),
      width: Math.round(clip.w),
      height: Math.round(clip.h),
      scale: 1
    };
    const r = await rpc(ws, 1, 'Page.captureScreenshot', { format: 'png', clip: c }, 30000);
    fs.writeFileSync(out, Buffer.from(r.result.data, 'base64'));
    console.log(JSON.stringify({ok:true, bytes:fs.statSync(out).size, clip:c}));
  });

  // 恢复 node 原始 height
  await withWs(compId, async ws => {
    await rpc(ws, 1, 'Runtime.evaluate', { expression: `
      (function(){
        var n = document.querySelector('[data-id="${dataId}"]');
        if (n) { n.style.height = '${clip.origH}'; var i=n.querySelector('iframe'); if(i) i.style.height='${clip.origH}'; }
      })()
    ` });
  });
})().catch(e => { console.error(e); process.exit(1); });
