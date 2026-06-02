// 从 /tmp/delete-plan.json 过滤出"页面 fork" 列表(排除图片素材/Logo/调色板)
const fs = require('fs');

const plan = JSON.parse(fs.readFileSync('/tmp/delete-plan.json', 'utf-8'));

// 判定是否页面 fork(要删):
// 看 label 是否是中文(或 "AI "开头)的页面名 — 不论宽度
function isPageFork(n) {
  const lbl = (n.label || '').trim();
  // 空 label → 跳过
  if (!lbl) return false;
  // Logo / palette / assets 等素材 → 跳过
  if (/Logo|palette|assets/i.test(lbl)) return false;
  // label 以纯英文长描述开头(图片生成结果)→ 跳过
  if (/^[A-Za-z]/.test(lbl) && !/^AI /.test(lbl)) return false;
  // 其余含中文的 → 视为页面 fork
  return /[一-鿿]/.test(lbl);
}

const pageForks = plan.deleteScreen.filter(isPageFork);
const assets = plan.deleteScreen.filter(n => !isPageFork(n));

console.log('=== 删除目标:页面 fork(将删) ===', pageForks.length);
pageForks.sort((a,b)=>a.label.localeCompare(b.label));
pageForks.forEach(n => console.log(`  ${n.id.slice(0,8)} | ${n.w}x${n.h} | ${n.label}`));

console.log('\n=== 保留:图片/Logo/调色板等素材(不删) ===', assets.length + plan.deleteOther.length);
[...assets, ...plan.deleteOther].forEach(n => console.log(`  ${n.id.slice(0,8)} | ${n.label}`));

fs.writeFileSync('/tmp/delete-pages.json', JSON.stringify(pageForks.map(n => n.id), null, 2));
console.log('\n=> 保存待删 dataId 列表到 /tmp/delete-pages.json');
