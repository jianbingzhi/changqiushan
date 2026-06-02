import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // 模块化单体边界:每个 modules/<x>/index.ts 才是对外公共面;跨模块直接 import 内部 service/repository 禁止
  {
    plugins: { boundaries },
    settings: {
      // module-public: 匹配 src/modules/<name>(目录形式) 和 src/modules/<name>/index.ts 两种写法
      // module-internal: 匹配模块根下直接文件(非index.ts)及子目录下的所有文件
      "boundaries/elements": [
        { type: "app", pattern: "src/app/**" },
        { type: "module-public", pattern: ["src/modules/*/index.ts", "src/modules/*"] },
        { type: "module-internal", pattern: ["src/modules/*/?*.ts", "src/modules/*/?*/**"] },
        { type: "infrastructure", pattern: "src/infrastructure/**" },
        { type: "shared", pattern: "src/shared/**" },
        { type: "lib", pattern: "src/lib/**" },
        { type: "generated", pattern: "src/generated/**" },
      ],
      "boundaries/ignore": ["**/*.test.ts", "**/*.test.tsx"],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          rules: [
            // app/ 路由层可以用任何模块的公共面 + infrastructure + shared/lib
            { from: { type: "app" }, allow: { to: { type: ["module-public", "infrastructure", "shared", "lib"] } } },
            // 模块对外只能从 index.ts 出去;index.ts 内部走 module-internal
            { from: { type: "module-public" }, allow: { to: { type: ["module-internal", "infrastructure", "shared", "generated"] } } },
            // 模块内部彼此可达,可以用 infrastructure / shared / 生成代码
            { from: { type: "module-internal" }, allow: { to: { type: ["module-internal", "infrastructure", "shared", "generated"] } } },
            // infrastructure 只依赖 shared / 生成代码
            { from: { type: "infrastructure" }, allow: { to: { type: ["shared", "generated", "infrastructure"] } } },
            // shared 是叶子,不依赖任何业务
            { from: { type: "shared" }, allow: { to: { type: ["shared"] } } },
            // lib 只依赖 lib / shared
            { from: { type: "lib" }, allow: { to: { type: ["lib", "shared"] } } },
          ],
        },
      ],
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**", // Prisma 生成代码不参与 lint
  ]),
]);

export default eslintConfig;
