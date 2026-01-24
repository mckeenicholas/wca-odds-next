<script setup lang="ts">
import ColorModeSwitcher from "@/components/custom/ColorModeSwitcher.vue";
import { Github } from "lucide-vue-next";
import { useRoute } from "vue-router";
import BackButton from "./components/custom/BackButton.vue";
import "./style.css";

const route = useRoute();

const versionNum = "1.0.0";
</script>

<template>
  <BackButton v-if="route.path !== '/'" />
  <div class="flex min-h-screen flex-col">
    <main class="grow">
      <ColorModeSwitcher />
      <RouterView class="-mt-4" />

      <div
        class="mt-4 flex flex-col items-center rounded-xl p-8 text-center shadow-sm"
      >
        <h2 class="mb-4 text-xl font-bold">Please consider donating!</h2>

        <p class="mb-6 max-w-xl leading-relaxed">
          Services like this offering statistical analysis require a
          considerable amount of compute power, which has costs associated with
          it. If you enjoy using this tool, please consider donating to help
          maintain it!
        </p>

        <a
          href="https://ko-fi.com/I2I51SX94L"
          target="_blank"
          class="transition-transform hover:scale-105"
        >
          <img
            src="https://storage.ko-fi.com/cdn/kofi6.png?v=6"
            alt="Buy Me a Coffee at ko-fi.com"
            class="h-10 border-0"
          />
        </a>
      </div>
    </main>
    <footer
      class="text-muted-foreground flex h-10 items-center justify-end px-4 text-sm font-semibold"
    >
      <span class="mr-3"
        >Made by
        <a class="underline hover:text-gray-300" href="https://nmckee.org"
          >Nicholas McKee</a
        >
      </span>
      <a
        href="https://github.com/mckeenicholas/wca-odds-web"
        class="mr-3 hover:text-gray-400"
        aria-label="GitHub Repository"
      >
        <Github class="h-4 w-4" />
      </a>
      <span>v{{ versionNum }}</span>
    </footer>
  </div>
</template>

<style lang="css">
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground));
  border-radius: 4px;
}

body {
  overflow-y: scroll;
}
</style>
