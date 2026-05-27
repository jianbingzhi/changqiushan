// Stitch 页面截图工具 — 调用 Page.captureScreenshot 把当前画布存到本地
//
// 用法:
//   node scripts/screenshot.js                       # 默认截主页面,存到 /tmp/stitch-screenshot.png
//   node scripts/screenshot.js out.png               # 指定输出路径
//   node scripts/screenshot.js out.jpg --jpeg        # JPEG 格式 (回传更快,默认 quality=85)
//   node scripts/screenshot.js out.png --companion   # 截 companion iframe 而不是主页面

const { CDP_HOST, getMainPageId, getCompanionId, rpc } = require('./lib.js');
const WebSocket = require('ws');
const fs = require('fs');

async function main() {
  const args = process.argv.slice(2);
  const useJpeg = args.includes('--jpeg');
  const useCompanion = args.includes('--companion');
  const positional = args.filter(a => !a.startsWith('--'));
  const out = positional[0] || (useJpeg ? '/tmp/stitch-screenshot.jpg' : '/tmp/stitch-screenshot.png');

  const id = useCompanion ? await getCompanionId() : await getMainPageId();
  if (!id) throw new Error(useCompanion ? 'no companion iframe' : 'no page target');

  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + id);
  await new Promise(r => ws.on('open', r));

  const params = useJpeg ? { format: 'jpeg', quality: 85 } : { format: 'png' };
  const t0 = Date.now();
  const res = await rpc(ws, 1, 'Page.captureScreenshot', params, 30000);
  const elapsed = Date.now() - t0;

  if (!res.result || !res.result.data) {
    ws.close();
    throw new Error('no data: ' + JSON.stringify(res).substring(0, 300));
  }

  const buf = Buffer.from(res.result.data, 'base64');
  fs.writeFileSync(out, buf);
  console.log(out + ' | ' + buf.length + ' bytes | ' + elapsed + 'ms');
  ws.close();
}

main().catch(e => { console.error(e.message); process.exit(1); });
