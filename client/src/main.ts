import type { VueQueryPluginOptions } from "@tanstack/vue-query";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "@/App.vue";
import router from "@/router";
import "@/style.css";
import "@cubing/icons";

const vueQueryPluginOptions: VueQueryPluginOptions = {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: Infinity,
      },
    },
  },
};

const pinia = createPinia();

const app = createApp(App)
  .use(router)
  .use(pinia)
  .use(VueQueryPlugin, vueQueryPluginOptions);

if (import.meta.env.DEV) {
  app.config.performance = true;
}

app.mount("#app");
