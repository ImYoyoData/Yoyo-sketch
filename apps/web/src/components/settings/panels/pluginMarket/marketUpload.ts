import { provide, type InjectionKey } from "vue";
import type { PluginUploadDraft } from "@yoyo/server/pluginDevelopment";

type OpenPluginUpload = (load: () => Promise<PluginUploadDraft>, signal: AbortSignal) => Promise<unknown>;
export const openPluginUploadKey: InjectionKey<OpenPluginUpload> = Symbol("openPluginUpload");

// ACT: 插件市场已断开官方服务，上传保持本地占位；需要分发时使用插件的导出分享。
export function providePluginUpload() {
  provide(openPluginUploadKey, async () => ({ status: "unavailable", message: "插件市场上传已停用，请使用导出分享分发插件。" }));
}
