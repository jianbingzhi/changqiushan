// 批量高清截图 — 读 JSON 清单,对每项调用 zoom-shot
// 用法: node scripts/batch-shot.js <list.json> <outDir>
//   list.json 形如: [{id,name},...]
const { zoomShot } = require('./zoom-shot.js');
const fs = require('fs');
const path = require('path');

async function main() {
  const [listFile, outDir] = process.argv.slice(2);
  if (!listFile || !outDir) {
    console.error('usage: node scripts/batch-shot.js <list.json> <outDir>');
    process.exit(1);
  }
  const list = JSON.parse(fs.readFileSync(listFile, 'utf-8'));
  fs.mkdirSync(outDir, { recursive: true });
  for (let i = 0; i < list.length; i++) {
    const { id, name } = list[i];
    const out = path.join(outDir, name + '.png');
    console.log(`[${i+1}/${list.length}] ${name} (${id})`);
    try {
      const r = await zoomShot(id, out);
      if (r.error) console.log('  ✗', r.error);
      else console.log('  ✓', r.bytes, 'B', JSON.stringify(r.clip));
    } catch (e) {
      console.log('  ✗ exception:', e.message);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
