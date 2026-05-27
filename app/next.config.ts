import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 让 Node 原生 require 这些包,而不是让 Turbopack/webpack 打包(pg-format 有动态 require)
  serverExternalPackages: ["pg", "pg-listen", "pg-format", "pg-native", "pg-boss", "@prisma/client", "@prisma/adapter-pg"],

  // Turbopack 的项目根目录(避免被父目录的 package-lock.json 误导)
  turbopack: {
    root: __dirname,
  },

  // build 时最多用 2 个 CPU(总核数 4),把另一半留给在跑的 dev server / Postgres
  // 配合 package.json 里的 nice/ionice,build 进程会主动让出 CPU 与 IO
  // 仅 build 时启用(dev 走 turbopack,设置这个会让 dev 启动卡住)
  ...(process.env["NEXT_BUILD_LIMIT"] === "1" && {
    experimental: { cpus: 2, workerThreads: false },
  }),
};

export default nextConfig;
