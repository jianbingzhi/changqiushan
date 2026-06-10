// T2e 端到端验收(docker 侧,临时脚本):
// ① 真 mp4 经 storage 层落自家桶(putObject→publicUrl);
// ② 活动正文带 <video> 走 contentService(zod→sanitize)入库:自家桶 src 保留+外链剥除;
// ③ 发布后经 C 端 /api/c/activities/:id 输出含 video 标签;④ 视频 URL 可公网读(200)。
// 真机(小程序 detail 播放)属用户侧验收。跑完清理活动行,保留桶内测试视频可手检后删。
import "dotenv/config";

if (!process.env.DATABASE_URL?.includes("localhost")) {
  throw new Error("verify-t2e 仅限本地库(DATABASE_URL 须含 localhost)");
}

import { readFileSync } from "fs";
import { createRequire } from "module";

// storage→integration.ts 带 "server-only" 哨兵(防密钥进客户端包),tsx 命中即抛——
// 脚本是纯服务端运维场景,先在 require 缓存打空桩再动态加载业务模块。
const req = createRequire(import.meta.url);
const soPath = req.resolve("server-only");
req.cache[soPath] = { id: soPath, filename: soPath, loaded: true, exports: {} } as NodeJS.Module;

const APP = process.env.VERIFY_APP_URL ?? "http://localhost:3000";

async function main() {
  const { contentService, contentRepository } = await import("../src/modules/content");
  const { putObject, publicUrl } = await import("../src/infrastructure/storage");
  const { db } = await import("../src/infrastructure/db/client");
  // ① 上传真 mp4 到自家桶
  const key = "public/assets/t2e-verify.mp4";
  const bytes = readFileSync("/tmp/t2e-test.mp4");
  await putObject(key, bytes, "video/mp4");
  const videoUrl = publicUrl(key);
  console.log(`① mp4 已入桶: ${videoUrl} (${bytes.length} 字节)`);

  // ② 创建活动:正文含 自家桶视频 + 外链视频(应被剥) + script(应被剥)
  const description =
    `<p>测试正文</p><video src="${videoUrl}"></video>` +
    `<video src="https://evil.example.org/x.mp4"></video><script>alert(1)</script>`;
  const created = await contentService.createContent("activity", {
    title: "T2E验收-富文本视频活动",
    description,
    startDate: "2026-07-01",
    endDate: "2026-07-02",
    registrationFee: 0,
  });
  if (!created.ok) throw new Error(`创建失败: ${created.message}`);
  const id = created.value.id;
  const saved = await contentRepository.getActivity(id);
  const desc = saved?.description ?? "";
  if (!desc.includes(`src="${videoUrl}"`)) throw new Error("② 自家桶视频被误剥!");
  if (desc.includes("evil.example.org") || desc.includes("script")) throw new Error("② 外链/script 未被剥!");
  if (!desc.includes("controls")) throw new Error("② controls 未强制注入!");
  console.log("② 入库消毒正确:自家桶 video 保留+controls,外链/script 剥除");

  // ③ 发布 → C 端 API 出 video
  const pub = await contentService.publishContent("activity", id);
  if (!pub.ok) throw new Error(`发布失败: ${pub.message}`);
  const res = await fetch(`${APP}/api/c/activities/${id}`);
  const body = (await res.json()) as { ok: boolean; data?: { description?: string } };
  if (!res.ok || !body.data?.description?.includes(`<video src="${videoUrl}"`)) {
    throw new Error(`③ C 端 API 未输出 video: HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
  }
  console.log("③ C 端 /api/c/activities/:id 输出 video 标签");

  // ④ 视频公网读
  const head = await fetch(videoUrl, { method: "HEAD" });
  const ct = head.headers.get("content-type");
  if (!head.ok || !ct?.includes("video/mp4")) throw new Error(`④ 视频 URL 不可读: ${head.status} ${ct}`);
  console.log(`④ 视频公网读 200, Content-Type=${ct}`);

  // 清理活动行(测试视频留桶可手检)
  await db.contentActivity.delete({ where: { id } });
  console.log("✅ T2E docker 侧端到端通过(真机小程序播放留用户验收)");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
