// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const buildId = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\.\d{3}Z$/, "Z");

const lovableMcpPlugin = mcpPlugin();
const configResolved = lovableMcpPlugin.configResolved;

// The MCP plugin currently compares Vite's normalized, forward-slash root with
// paths returned by node:path, which use backslashes on Windows. Give only this
// plugin a Windows-native root so its containment checks work correctly.
if (typeof configResolved === "function") {
  lovableMcpPlugin.configResolved = function (config) {
    return configResolved.call(this, {
      ...config,
      root: process.platform === "win32" ? config.root.replaceAll("/", "\\") : config.root,
    });
  };
}

export default defineConfig({
  nitro: { preset: "vercel" },
  vite: {
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(version),
      "import.meta.env.VITE_APP_BUILD": JSON.stringify(buildId),
    },
    plugins: [lovableMcpPlugin],
    build: {
      // The Lovable MCP package probes this Workers-only module dynamically
      // and catches the import error on Node runtimes such as Vercel.
      rollupOptions: { external: ["cloudflare:workers"] },
    },
  },
});
