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
      "boundaries/elements": [
        { type: "app", pattern: "src/app/**" },
        { type: "module-public", pattern: "src/modules/*/index.ts", mode: "file" },
        { type: "module-internal", pattern: "src/modules/*/**", mode: "full" },
        { type: "infrastructure", pattern: "src/infrastructure/**" },
        { type: "shared", pattern: "src/shared/**" },
        { type: "lib", pattern: "src/lib/**" },
        { type: "generated", pattern: "src/generated/**" },
      ],
      "boundaries/ignore": ["**/*.test.ts", "**/*.test.tsx"],
    },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            // app/ 路由层可以用任何模块的公共面 + infrastructure + shared/lib
            { from: "app", allow: ["module-public", "infrastructure", "shared", "lib"] },
            // 模块对外只能从 index.ts 出去;index.ts 内部走 module-internal
            { from: "module-public", allow: ["module-internal", "infrastructure", "shared", "generated"] },
            // 模块内部彼此可达,可以用 infrastructure / shared / 生成代码
            { from: "module-internal", allow: ["module-internal", "infrastructure", "shared", "generated"] },
            // infrastructure 只依赖 shared / 生成代码
            { from: "infrastructure", allow: ["shared", "generated", "infrastructure"] },
            // shared 是叶子,不依赖任何业务
            { from: "shared", allow: ["shared"] },
            // lib 只依赖 lib / shared
            { from: "lib", allow: ["lib", "shared"] },
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
