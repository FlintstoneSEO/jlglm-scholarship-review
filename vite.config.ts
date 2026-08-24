// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

const lovableMcpPlugin = mcpPlugin();
const configResolved = lovableMcpPlugin.configResolved;

// The MCP plugin currently compares Vite's normalized, forward-slash root with
// paths returned by node:path, which use backslashes on Windows. Give only this
// plugin a Windows-native root so its containment checks work correctly.
if (typeof configResolved === "function") {
  lovableMcpPlugin.configResolved = function (config) {
    return configResolved.call(this, {
      ...config,
      root:
        process.platform === "win32"
          ? config.root.replaceAll("/", "\\")
          : config.root,
    });
  };
}

export default defineConfig({ vite: { plugins: [lovableMcpPlugin] } });
