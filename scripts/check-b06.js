const { getCompanionId, rpc, CDP_HOST } = require('/home/agent/projects/Panda/Changqiushan/scripts/lib.js');
const WebSocket = require('ws');
(async () => {
  const id = await getCompanionId();
  const ws = new WebSocket('ws://' + CDP_HOST + '/devtools/page/' + id);
  await new Promise(r => ws.on('open', r));
  const expr = `
    (function(){
      var n = document.querySelector('[data-id="ae581be8de1c42df94e2df1e2d052ecf"]');
      if (!n) return { err: 'NO_NODE' };
      var i = n.querySelector('iframe');
      if (!i) return { err: 'NO_IFRAME' };
      var sd = i.srcdoc || '';
      return {
        srcdocLen: sd.length,
        has_aside: sd.includes('aside'),
        has_basic: sd.includes('基础宣传管理'),
        has_appt: sd.includes('预约管理中心'),
        has_helpSupport: sd.includes('帮助支持'),
        has_active: sd.includes('AI 问答知识库'),
        sidebar_excerpt: (function(){
          var m = sd.match(/aside[\\s\\S]{0,3000}<\\/aside>/);
          if (!m) return null;
          return m[0].replace(/<[^>]+>/g, '|').replace(/\\s+/g, ' ').slice(0, 600);
        })()
      };
    })()
  `;
  const r = await rpc(ws, 1, 'Runtime.evaluate', { expression: expr, returnByValue: true });
  console.log(JSON.stringify(r.result?.result?.value, null, 2));
  ws.close();
})();
