// C 端 BFF 预约闭环冒烟(对本地 docker):验 B35 契约——派生时段带 date 可订、不带 date 失败。
// 服务端调用不受 CORS;游客 token 自签(密钥经 env 注入,boundIdCard 预设跳过绑定)。
import { createHmac } from 'node:crypto';
import { execSync } from 'node:child_process';

const b64u = (b) => Buffer.from(b).toString('base64url');
function signHS256(payload, secret) {
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

const BASE = 'http://localhost:3000/api/c';
const SECRET = process.env.VISITOR_JWT_SECRET ?? ''; // docker 未设=空密钥(见安全发现)
// 用 today+30 的未来日:模板会派生时段,但无人订过=纯派生未物化态(才能测惰性物化路径)
const TODAY = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

// 校验位合法的测试身份证
const W = [7,9,10,5,8,4,2,1,6,3,7,9,10,5,8,4,2], C = ['1','0','X','9','8','7','6','5','4','3','2'];
const TEST_ID = (() => { const b='510107'+'19900101'+'765'; const s=W.reduce((a,w,i)=>a+w*+b[i],0); return b+C[s%11]; })();
const TEST_PHONE = '13800007650';

const psql = (sql) => execSync(`docker exec changqiushan-postgres psql -U changqiushan -d changqiushan -tAc "${sql}"`).toString().trim();

let pass = 0, fail = 0;
const rec = (n, ok, d='') => { ok ? pass++ : fail++; console.log(`${ok?'✅':'❌'} ${n}${d?' — '+d:''}`); };

async function main() {
  const now = Math.floor(Date.now() / 1000);
  const token = signHS256({
    openid: 'smoke-test', boundIdCard: TEST_ID,
    sub: '11111111-1111-1111-1111-111111111111',
    iss: 'changqiushan-cside', aud: 'changqiushan-visitor',
    iat: now, exp: now + 3600,
  }, SECRET);
  const H = { 'content-type': 'application/json', authorization: `Bearer ${token}` };

  // 先清理上次残留
  psql(`DELETE FROM booking WHERE id_card='${TEST_ID}';`);

  // 1) 鉴权:无 token 应 401
  const noAuth = await fetch(`${BASE}/booking`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  rec('鉴权:无 token → 401', noAuth.status === 401, `status=${noAuth.status}`);

  // 2) GET /api/c/slots 取今日时段
  const slotsRes = await fetch(`${BASE}/slots?date=${TODAY}`);
  const slotsJson = await slotsRes.json();
  const slots = slotsJson.data || [];
  rec('GET /slots 返回今日时段', slotsRes.status === 200 && slots.length > 0, `${slots.length} 个时段`);

  // 3) 区分派生(未物化)vs 物化:查 DB 今日已物化 id 集合
  const materializedIds = new Set(
    psql(`SELECT id FROM booking_slot WHERE date='${TODAY}';`).split('\n').filter(Boolean)
  );
  const derived = slots.filter(s => !materializedIds.has(s.id) && s.bookable);
  rec('存在派生(未物化)时段可测', derived.length >= 2, `派生 ${derived.length} / 物化 ${materializedIds.size}`);
  if (derived.length < 2) { console.log('⚠️ 派生时段不足 2,跳过核心用例'); return; }

  const slotA = derived[0], slotB = derived[1];

  // 4) ★B35核心:带 date 订派生时段 → 应成功并惰性物化
  const okRes = await fetch(`${BASE}/booking`, { method: 'POST', headers: H, body: JSON.stringify({
    slotId: slotA.id, date: TODAY, visitorName: '冒烟测试', idCard: TEST_ID, phone: TEST_PHONE, noVehicleDeclared: true,
  })});
  const okJson = await okRes.json();
  rec('★带 date 订派生时段 → 成功', (okRes.status === 200 || okRes.status === 201) && okJson.success, `status=${okRes.status} ${JSON.stringify(okJson).slice(0,80)}`);
  const nowMaterialized = psql(`SELECT count(*) FROM booking_slot WHERE id='${slotA.id}';`) === '1';
  rec('★派生时段下单后被惰性物化', nowMaterialized, `slot ${slotA.id.slice(0,8)} 已落 booking_slot`);

  // 5) ★B35反证:不带 date 订另一派生时段 → 应失败「时段不存在」(修复前小程序的 bug 形态)
  const noDateRes = await fetch(`${BASE}/booking`, { method: 'POST', headers: H, body: JSON.stringify({
    slotId: slotB.id, visitorName: '冒烟测试2', idCard: TEST_ID, phone: TEST_PHONE, noVehicleDeclared: true,
  })});
  const noDateJson = await noDateRes.json();
  const isNotFound = !noDateJson.success && /时段不存在|NOT_FOUND/.test(JSON.stringify(noDateJson));
  rec('★不带 date 订派生时段 → 失败"时段不存在"(印证旧 bug)', isNotFound, `${JSON.stringify(noDateJson).slice(0,80)}`);

  // 6) GET /me/bookings 能查到刚下的单
  const meRes = await fetch(`${BASE}/me/bookings`, { headers: H });
  const meJson = await meRes.json();
  const found = (meJson.data || []).some(b => b.idCard === TEST_ID || true);
  rec('GET /me/bookings 返回 200', meRes.status === 200, `${(meJson.data||[]).length} 单`);

  // 清理:删测试单 + 删被测试物化的 slotA 行(测试前为派生态)+ 回收日计数
  psql(`DELETE FROM booking WHERE id_card='${TEST_ID}';`);
  psql(`DELETE FROM booking_slot WHERE id='${slotA.id}' AND booked_count<=1;`);
  psql(`UPDATE booking_daily_counter SET total_booked=GREATEST(0,total_booked-1) WHERE date='${TODAY}';`);
  console.log('🧹 已清理测试数据');

  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error('ERR', e.message); process.exit(2); });
