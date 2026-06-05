#!/usr/bin/env node
// 上传体验版到微信(miniprogram-ci)。CI/发版用,本地需先 `pnpm add -D miniprogram-ci`。
// 用法: WX_APPID=... WX_PRIVATE_KEY_PATH=./private.key node scripts/upload.mjs [version] [desc]
// 上传码包密钥从微信公众平台「开发管理-开发设置」下载,绝不入库(gitignore)。

import { existsSync } from "node:fs";
import { resolve } from "node:path";

const appid = process.env.WX_APPID;
const privateKeyPath = process.env.WX_PRIVATE_KEY_PATH;
const version = process.argv[2] || process.env.WX_VERSION || "1.0.0";
const desc = process.argv[3] || process.env.WX_DESC || `自动上传 ${version}`;

if (!appid || !privateKeyPath) {
  console.error("缺少环境变量 WX_APPID / WX_PRIVATE_KEY_PATH");
  process.exit(1);
}
if (!existsSync(privateKeyPath)) {
  console.error(`上传密钥文件不存在: ${privateKeyPath}`);
  process.exit(1);
}
if (!existsSync(resolve("dist/app.json"))) {
  console.error("未找到 dist/,请先执行 pnpm build:weapp");
  process.exit(1);
}

let ci;
try {
  ci = (await import("miniprogram-ci")).default;
} catch {
  console.error("未安装 miniprogram-ci,请先执行: pnpm add -D miniprogram-ci");
  process.exit(1);
}

const project = new ci.Project({
  appid,
  type: "miniProgram",
  projectPath: resolve("dist"),
  privateKeyPath: resolve(privateKeyPath),
  ignores: ["node_modules/**/*"],
});

const result = await ci.upload({
  project,
  version,
  desc,
  setting: { es6: true, minify: true },
  onProgressUpdate: () => {},
});
console.log(`[upload] ✔ 已上传体验版 ${version}`);
console.log(result);
