import { createApp, type App } from "vue";
import { createPinia } from "pinia";
import { createPersistedState } from "pinia-plugin-persistedstate";
import { actualPlatform } from "@/lib/platform";

export async function createCreationApp(): Promise<App<Element>> {
  const [
    { default: appRoot }, { default: router }, { loadSettings, settingsStorage }, { registerLanguage },
    { registerDownloads }, { registerDesktopProtocol }, { registerDesktopAutoUpdate },
  ] = await Promise.all([
    import("@/App.vue"), import("@/router"), import("@/stores/settings"), import("@/lib/i18n"),
    import("@/lib/saveFile"), import("@/lib/desktopProtocol"), import("@/stores/desktopUpdate"),
  ]);
  await loadSettings();
  const app = createApp(appRoot);
  app.onUnmount(registerLanguage());
  app.use(createPinia().use(createPersistedState({ storage: settingsStorage })));
  app.use(router);
  await router.isReady();
  app.onUnmount(registerDownloads());
  if (actualPlatform.isLocalDesktop) {
    app.onUnmount(registerDesktopProtocol());
    app.onUnmount(registerDesktopAutoUpdate());
  }
  return app;
}
