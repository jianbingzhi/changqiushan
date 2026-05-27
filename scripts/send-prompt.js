// Stitch 提示词发送脚本 — 将文本文件内容输入到 Stitch AI 对话框并提交
//
// 用法:
//   node scripts/send-prompt.js <prompt_file.txt>

const { sendPrompt } = require('./lib.js');

async function main() {
  const file = process.argv[2];
  if (!file) { console.log('Usage: node scripts/send-prompt.js <prompt_file>'); return; }

  console.log('Sending:', file);
  await sendPrompt(file);
  console.log('Done');
}
main().catch(e => { console.error('Error:', e.message); process.exit(1); });
