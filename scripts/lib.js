// Stitch CDP 核心库 — 提供 WebSocket 连接、鼠标/键盘操作、页面查询等基础能力
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');

// Chrome 跑在 Windows 上，通过 WG 隧道暴露在 10.7.0.2:9222
const CDP_HOST = '10.7.0.2:9222';

// ========== CDP 连接 ==========

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://' + CDP_HOST + '/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function getCompanionId() {
  const targets = await getTargets();
  for (const t of targets) {
    if (t.type === 'iframe' && t.url && t.url.includes('app-companion')) {
      return t.id;
    }
  }
  return null;
}

async function getMainPageId() {
  const targets = await getTargets();
  for (const t of targets) {
    if (t.type === 'page') return t.id;
  }
  return null;
}

// ========== CDP RPC ==========

function rpc(ws, id, method, params, timeoutMs) {
  timeoutMs = timeoutMs || 15000;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { reject(new Error('timeout: ' + method)); }, timeoutMs);
    const h = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) { clearTimeout(t); ws.removeListener('message', h); resolve(msg); }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({id, method, params: params || {}}));
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function randomDelay(min, max) {
  return sleep(min + Math.random() * (max - min));
}

// ========== 页面节点查询 ==========

async function getPageNodes(compWs) {
  const expr = '(function(){var n=[];document.querySelectorAll(".react-flow__node-node-screen").forEach(function(e){var t=e.textContent.trim();if(!t.startsWith("devices"))return;var name=t.replace(/^devices/,"").trim();var rect=e.getBoundingClientRect();n.push({name:name,x:Math.round(rect.x+rect.width/2),y:Math.round(rect.y+rect.height/2)});});return JSON.stringify(n);})()';
  const res = await rpc(compWs, 1, 'Runtime.evaluate', {expression: expr});
  return JSON.parse(res.result.result.value);
}

// ========== Toast/通知处理 ==========

async function dismissToasts(compWs) {
  // 查找右下角的下载完成/导出成功 toast 通知
  const expr = `(function() {
    // 尝试查找各种 toast/notification 元素
    var selectors = [
      '[class*=toast]', '[class*=notification]', '[class*=snackbar]',
      '[class*=alert]', '[role=alert]', '[class*=popup]',
      '[class*=banner]', '[class*=message]'
    ];
    var found = [];
    selectors.forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(el) {
        var rect = el.getBoundingClientRect();
        // 只关心右下角附近的 (x > 窗口宽度的60%, y > 窗口高度的60%)
        if (rect.x > window.innerWidth * 0.5 && rect.y > window.innerHeight * 0.5) {
          found.push({
            text: (el.textContent || '').trim().substring(0, 60),
            x: Math.round(rect.x + rect.width/2),
            y: Math.round(rect.y + rect.height/2)
          });
        }
      });
    });
    return JSON.stringify(found);
  })()`;

  const res = await rpc(compWs, 1, 'Runtime.evaluate', {expression: expr});
  const toasts = JSON.parse(res.result.result.value || '[]');

  for (const toast of toasts) {
    // 尝试点击 toast 关闭按钮
    try {
      await rpc(compWs, 10, 'Input.dispatchMouseEvent', {
        type: 'mousePressed', x: toast.x + 40, y: toast.y, button: 'left', clickCount: 1
      });
      await rpc(compWs, 11, 'Input.dispatchMouseEvent', {
        type: 'mouseReleased', x: toast.x + 40, y: toast.y, button: 'left', clickCount: 1
      });
      await sleep(300);
    } catch(e) {}
  }

  // 再按 ESC 确保关闭
  try {
    await rpc(compWs, 20, 'Input.dispatchKeyEvent', {type: 'keyDown', key: 'Escape', code: 'Escape'});
    await rpc(compWs, 21, 'Input.dispatchKeyEvent', {type: 'keyUp', key: 'Escape', code: 'Escape'});
  } catch(e) {}

  return toasts.length;
}

// ========== 页面状态 ==========

async function getStatus() {
  const id = await getCompanionId();
  if (!id) return null;
  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + id);
  await new Promise(r => ws.on('open', r));
  const r = await rpc(ws, 1, 'Runtime.evaluate', {
    expression: '(function(){var t=document.body?document.body.innerText:"";var pm=t.match(/(\\d+)%/);return JSON.stringify({progress:pm?pm[1]:"?",textLen:t.length});})()'
  });
  const status = JSON.parse(r.result?.result?.value || '{}');
  ws.close();
  return status;
}

// ========== 发送提示词 ==========

async function sendPrompt(promptFile) {
  const id = await getCompanionId();
  if (!id) throw new Error('No companion iframe found');

  const promptText = fs.readFileSync(promptFile, 'utf-8').trim();
  console.log('Prompt:', promptText.length, 'chars, Target:', id);

  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + id);
  await new Promise(r => ws.on('open', r));

  const posR = await rpc(ws, 1, 'Runtime.evaluate', {
    expression: '(function(){var el=document.querySelector(".ProseMirror");if(!el)return JSON.stringify({found:false});var rect=el.getBoundingClientRect();return JSON.stringify({found:true,x:Math.round(rect.x+rect.width/2),y:Math.round(rect.y+rect.height/2)});})()'
  });
  const pos = JSON.parse(posR.result?.result?.value || '{}');
  if (!pos.found) throw new Error('ProseMirror not found');

  await rpc(ws, 10, 'Input.dispatchMouseEvent', {type:'mousePressed', x:pos.x, y:pos.y, button:'left', clickCount:3});
  await rpc(ws, 11, 'Input.dispatchMouseEvent', {type:'mouseReleased', x:pos.x, y:pos.y, button:'left', clickCount:3});
  await sleep(300);

  await rpc(ws, 12, 'Runtime.evaluate', {
    expression: '(function(){var el=document.querySelector(".ProseMirror");if(!el)return"no";el.innerHTML="";el.dispatchEvent(new Event("input",{bubbles:true}));return"ok";})()'
  });
  await sleep(200);

  await rpc(ws, 20, 'Input.insertText', {text: promptText});

  const v = await rpc(ws, 30, 'Runtime.evaluate', {
    expression: '(function(){var el=document.querySelector(".ProseMirror");return el?el.textContent.substring(0,80):"NO";})()'
  });
  console.log('Verify:', v.result?.result?.value);

  await rpc(ws, 40, 'Input.dispatchKeyEvent', {type:'keyDown', key:'Enter', code:'Enter'});
  await rpc(ws, 41, 'Input.dispatchKeyEvent', {type:'char', text:'\r', key:'Enter', code:'Enter'});
  await rpc(ws, 42, 'Input.dispatchKeyEvent', {type:'keyUp', key:'Enter', code:'Enter'});
  console.log('Submitted');

  ws.close();
  return true;
}

// ========== 等待 Stitch AI 完成 ==========

async function waitForCompletion(maxMinutes) {
  maxMinutes = maxMinutes || 15;
  console.log('Waiting for Stitch (max ' + maxMinutes + ' min)...');
  let lastProgress = -1;
  let stableCount = 0;

  for (let i = 0; i < maxMinutes * 4; i++) {
    await sleep(15000);
    try {
      const status = await getStatus();
      if (!status) continue;
      const ts = new Date().toLocaleTimeString();
      if (status.progress !== lastProgress) {
        console.log(ts + ' | ' + lastProgress + '% -> ' + status.progress + '%');
        stableCount = 0;
        lastProgress = status.progress;
      } else {
        stableCount++;
      }
      if (parseInt(status.progress) >= 98) {
        console.log(ts + ' | DONE: ' + status.progress + '%');
        return true;
      }
      if (stableCount >= 8) {
        console.log(ts + ' | Stable at ' + status.progress + '%');
        return true;
      }
    } catch(e) {
      console.log('Check error:', e.message);
    }
  }
  console.log('Timeout');
  return false;
}

module.exports = {
  CDP_HOST,
  getTargets, getCompanionId, getMainPageId,
  rpc, sleep, randomDelay,
  getPageNodes, dismissToasts,
  getStatus, sendPrompt, waitForCompletion
};
