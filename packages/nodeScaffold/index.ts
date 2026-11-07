import { copyFile, mkdir, readFile, rename, rm } from "@yoyo/file";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import type { Rule } from "@form-create/element-ui";
import { z } from "zod";
import postcssConfig from "../../postcss.config.ts";

const tiptapGlobals = {
  "@tiptap/core": "yoyoTiptapHost.core",
  "@tiptap/vue-3": "yoyoTiptapHost.vue3",
  "@tiptap/starter-kit": "yoyoTiptapHost.starterKit",
  "@tiptap/markdown": "yoyoTiptapHost.markdown",
  "@tiptap/extension-find-and-replace": "yoyoTiptapHost.findAndReplace",
  "@tiptap/extension-highlight": "yoyoTiptapHost.highlight",
  "@tiptap/extension-image": "yoyoTiptapHost.image",
  "@tiptap/extension-list": "yoyoTiptapHost.list",
  "@tiptap/extension-subscript": "yoyoTiptapHost.subscript",
  "@tiptap/extension-superscript": "yoyoTiptapHost.superscript",
  "@tiptap/extension-table": "yoyoTiptapHost.table",
  "@tiptap/extension-text-align": "yoyoTiptapHost.textAlign",
  "@tiptap/pm/model": "yoyoTiptapHost.model",
  "@tiptap/pm/state": "yoyoTiptapHost.state",
  "@tiptap/pm/view": "yoyoTiptapHost.view",
  "marked": "yoyoTiptapHost.marked",
  "dompurify": "yoyoTiptapHost.dompurify",
};

export interface NodeConfig {
  name: string;
  displayName: string;
  author: string;
  github: string;
  configRules?: Rule[];
  serverTool?: string;
}

export function createNodeConfig(config: NodeConfig, configUrl: string, options: { outDir?: string; syncToData?: boolean } = {}) {
  const { name: nodeName } = config;
  const metadata = {
    displayName: config.displayName.trim(),
    author: config.author.trim(),
    github: config.github.trim(),
    configRules: z.array(z.record(z.string(), z.json())).max(100).parse(config.configRules ?? []),
  };
  if (!metadata.displayName) throw new Error("插件显示名不能为空");
  if (metadata.github) {
    const githubUrl = new URL(metadata.github);
    if (githubUrl.origin !== "https://github.com" || githubUrl.username || githubUrl.password) throw new Error("GitHub 地址必须是 https://github.com 下的地址");
  }
  const root = fileURLToPath(new URL(".", configUrl));
  if (!/^[a-z][a-zA-Z0-9]*$/.test(nodeName)) throw new Error(`节点名必须使用小驼峰：${nodeName}`);
  const fileName = `${nodeName}.umd.js`;
  const outDir = options.outDir ? resolve(root, options.outDir) : fileURLToPath(new URL("../../build/nodes", import.meta.url));
  const dataDir = fileURLToPath(new URL("../../data/nodes", import.meta.url));
  let syncToData = options.syncToData ?? process.env.NODE_ENV === "dev";

  return defineConfig({
    root,
    css: { postcss: postcssConfig },
    plugins: [
      vue(),
      {
        name: "syncNodeFile",
        enforce: "post",
        configResolved(resolvedConfig) {
          if (options.syncToData === undefined) syncToData ||= Boolean(resolvedConfig.build.watch) || resolvedConfig.mode === "development";
        },
        async generateBundle(_options, bundle) {
          const chunk = bundle[fileName];
          if (!chunk || chunk.type !== "chunk") throw new Error(`未生成节点文件：${fileName}`);
          if (Object.keys(bundle).length !== 1) throw new Error(`节点必须构建为单个脚本，不能包含未内联的资源：${nodeName}`);
          const packagePath = resolve(root, "package.json");
          this.addWatchFile(packagePath);
          const packageInfo = JSON.parse(await readFile(packagePath, "utf8"));
          const version = typeof packageInfo.version === "string" ? packageInfo.version.trim() : "";
          if (!version) throw new Error(`节点 package.json 缺少有效的 version：${nodeName}`);
          const readmePath = resolve(root, "readme.md");
          this.addWatchFile(readmePath);
          const readme = await readFile(readmePath, "utf8").catch((error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") return "";
            throw error;
          });
          let serverTool: string | undefined;
          if (config.serverTool !== undefined) {
            const toolPath = resolve(root, config.serverTool);
            this.addWatchFile(toolPath);
            serverTool = await readFile(toolPath, "utf8");
            const toolHeader = serverTool.match(/^\/\*! yoyoTool:([^\r\n]*) \*\/(?:\r?\n|$)/)?.[1];
            if (!toolHeader || JSON.parse(toolHeader).name !== nodeName || Buffer.byteLength(serverTool, "utf8") > 20 * 1024 * 1024) {
              throw new Error(`节点配套服务必须是同名且不超过 20 MB 的已构建工具：${nodeName}`);
            }
          }
          // 压缩后再写入，防止元数据注释被移除。
          chunk.code = `/*! yoyoNode:${JSON.stringify({ ...metadata, version, readme, ...(serverTool ? { serverTool } : {}) }).replaceAll("/", "\\u002f")} */\n${chunk.code}`;
          if (Buffer.byteLength(chunk.code, "utf8") > 20 * 1024 * 1024) throw new Error(`节点与配套服务合计不能超过 20 MB：${nodeName}`);
        },
        async writeBundle() {
          if (!syncToData) return;
          await mkdir(dataDir, { recursive: true });
          const targetPath = resolve(dataDir, fileName);
          const tempPath = `${targetPath}.${crypto.randomUUID()}.tmp`;
          try {
            await copyFile(resolve(outDir, fileName), tempPath);
            await rename(tempPath, targetPath);
          } finally {
            await rm(tempPath, { force: true });
          }
        },
      },
    ],
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      outDir,
      // ACT: 单包构建不清公共产物目录，由根 build:nodes 在批量构建前统一清理。
      emptyOutDir: false,
      assetsInlineLimit: Number.MAX_SAFE_INTEGER,
      cssCodeSplit: true,
      lib: {
        entry: resolve(root, "src/index.vue"),
        name: `yoyoNodes.${nodeName}`,
        formats: ["umd"],
        fileName: () => fileName,
      },
      rolldownOptions: {
        external: ["vue", "@vue/runtime-core", "@vue/runtime-dom", "@vue-flow/core", "element-plus", "three", "@yoyo/model-icons", "@earendil-works/pi-agent-core", "@earendil-works/pi-ai", ...Object.keys(tiptapGlobals)],
        output: {
          exports: "default",
          globals: {
            ...tiptapGlobals,
            vue: "yoyoNodeHost.vue",
            "@vue/runtime-core": "yoyoNodeHost.vue",
            "@vue/runtime-dom": "yoyoNodeHost.vue",
            "@vue-flow/core": "yoyoNodeHost.vueFlow",
            "element-plus": "yoyoNodeHost.elementPlus",
            three: "yoyoNodeHost.three",
            "@yoyo/model-icons": "yoyoNodeHost.modelIcons",
            "@earendil-works/pi-agent-core": "yoyoNodeHost.ai",
            "@earendil-works/pi-ai": "yoyoNodeHost.ai",
          },
        },
      },
    },
  });
}
