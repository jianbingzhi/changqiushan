// Per-page 端到端编排 v2 — sendPrompt → waitStable → findNode → screenshot → verify (Chinese + Forbidden) → 日志
//
// 用法:
//   node scripts/run-page.js <pageId> <pageLabelChinese> <promptFile> <outPng>
// 示例:
//   node scripts/run-page.js A4 "填写预约信息" prompts/A4-booking-form.txt UI/01_C端小程序/A4_填写预约信息.png

const { snapshotNodes, diffNodes, log } = require('./session.js');
const { sendPrompt, sleep } = require('./lib.js');
const { findPageByLabel } = require('./find-page.js');
const { verifyChinese, verifyForbiddenTerms, captureNode } = require('./verify.js');
const crypto = require('crypto');

function sig(nodes) {
  const d = nodes.map(n => `${n.dataId}|${n.text.slice(0, 200)}|${n.w}x${n.h}`).sort().join('\n');
  return crypto.createHash('md5').update(d).digest('hex').slice(0, 12);
}

async function waitStable(maxMin = 12, cycles = 4, intervalMs = 10000) {
  let lastSig = null, stable = 0;
  const t0 = Date.now();
  const maxIter = (maxMin * 60 * 1000) / intervalMs;
  for (let i = 0; i < maxIter; i++) {
    const nodes = await snapshotNodes();
    const s = sig(nodes);
    const el = Math.round((Date.now() - t0) / 1000);
    if (s === lastSig) {
      stable++;
      console.log(`[${el}s] count=${nodes.length} stable=${stable}/${cycles}`);
      if (stable >= cycles) return { ok: true, count: nodes.length, elapsedSec: el };
    } else {
      stable = 0;
      console.log(`[${el}s] count=${nodes.length} CHANGED sig=${s}`);
      lastSig = s;
    }
    await sleep(intervalMs);
  }
  return { ok: false, elapsedSec: Math.round((Date.now() - t0) / 1000) };
}

async function sendOnce(promptFile) {
  try {
    await sendPrompt(promptFile);
    await sleep(3000);
    return true;
  } catch (e) {
    console.log('send error:', e.message);
    return false;
  }
}

async function main() {
  const [pageId, label, promptFile, outPng] = process.argv.slice(2);
  if (!pageId || !label || !promptFile || !outPng) {
    console.error('usage: node scripts/run-page.js <pageId> <label> <promptFile> <outPng>');
    process.exit(1);
  }

  console.log(`\n=== ${pageId} | ${label} ===`);
  const before = await snapshotNodes();
  console.log(`before: ${before.length} nodes`);

  // 1. send prompt (retry 2x if no node-count change after wait)
  console.log('--- send prompt ---');
  let ok = false;
  for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
    if (!(await sendOnce(promptFile))) { console.log('attempt ' + attempt + ' send failed'); continue; }
    // 立即检查节点是否在变(发送成功的话 5-10s 内应有变化)
    await sleep(5000);
    const probe = await snapshotNodes();
    if (probe.length !== before.length || sig(probe) !== sig(before)) {
      ok = true;
      console.log('attempt ' + attempt + ': prompt submitted (delta detected)');
      break;
    }
    console.log('attempt ' + attempt + ': no change yet, retrying send');
  }
  if (!ok) { console.error('FATAL: prompt never registered'); process.exit(2); }

  // 2. wait stable
  console.log('--- wait stable ---');
  const stab = await waitStable();
  if (!stab.ok) { console.error('FATAL: did not stabilize'); process.exit(3); }

  const after = await snapshotNodes();
  const newOnes = diffNodes(before, after);
  console.log(`after: ${after.length} (+${newOnes.length} new)`);

  // 3. find page node — 优先 newly-added device node (避免和之前的同名页冲突)
  const newDevices = newOnes.filter(n => /node-screen/.test(n.cls) && /^devices/.test(n.text));
  let pageNode = null;
  if (newDevices.length === 1) {
    pageNode = { dataId: newDevices[0].dataId, label: newDevices[0].text.replace(/^devices/, '').trim() };
  } else if (newDevices.length > 1) {
    // FORK! Stitch made multiple variants
    console.log(`⚠ FORK DETECTED: ${newDevices.length} new device nodes for "${label}"`);
    newDevices.forEach(d => console.log('   ', d.dataId, '|', d.text.slice(0, 60)));
    // 取最后一个为 canonical (最新)
    const last = newDevices[newDevices.length - 1];
    pageNode = { dataId: last.dataId, label: last.text.replace(/^devices/, '').trim(), forks: newDevices.map(d => d.dataId) };
  }
  if (!pageNode) {
    const matches = await findPageByLabel(label);
    pageNode = matches.filter(m => m.type === 'device')[0] || matches[0];
  }
  if (!pageNode) { console.error('FATAL: cannot locate page node'); process.exit(4); }
  const pid = pageNode.dataId || (pageNode.testid || '').replace('rf__node-', '');
  if (pageNode.forks) log({ event: 'fork_detected', page: pageId, label, forks: pageNode.forks });
  console.log(`pageNode: ${pid} (${pageNode.label || pageNode.text})`);

  const sel = `[data-id="${pid}"]`;

  // 4. capture screenshot
  console.log('--- screenshot ---');
  const cap = await captureNode(sel, outPng);
  console.log(`screenshot: ${cap.ok ? cap.path + ' ' + cap.bytes + 'B' : JSON.stringify(cap)}`);

  // 5. verify — 用 page-data-id 精确寻 iframe target,避免 fork 误判
  console.log('--- verify chinese + forbidden (page=' + pid + ') ---');
  const cn = await verifyChinese(pid);
  const fb = await verifyForbiddenTerms(pid);
  console.log(`chinese: ${cn.ok ? 'PASS' : 'FAIL '+cn.count}`);
  if (!cn.ok) cn.offenders.forEach(o => console.log('  CN:', o.kind, o.word, '|', (o.context||'').slice(0, 80)));
  console.log(`forbidden: ${fb.ok ? 'PASS' : 'FAIL '+fb.count}`);
  if (!fb.ok) fb.offenders.forEach(o => console.log('  FB:', o.word, '|', (o.context||'').slice(0, 80)));

  const status = (cn.ok && fb.ok) ? 'PASS' : 'FAIL';
  log({
    page: pageId, name: label, prompt: promptFile,
    nodesBefore: before.length, nodesAfter: after.length, newCount: newOnes.length,
    pageNodeId: pid,
    verify: { chinese: cn, forbidden: fb },
    screenshot: outPng,
    status
  });

  console.log(status === 'PASS' ? '\n✓ PASS' : '\n✗ FAIL — needs narrow correction');
  process.exit(status === 'PASS' ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(99); });
