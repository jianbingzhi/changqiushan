import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// 纯 domain 单测:不连 DB、不起 Next;@/ 别名与 tsconfig 对齐
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
