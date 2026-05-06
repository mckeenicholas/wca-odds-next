<script setup lang="ts">
import { Github } from "lucide-vue-next";
import { onErrorCaptured, ref } from "vue";
import { useRoute } from "vue-router";
import BackButton from "@/components/custom/BackButton.vue";
import ColorModeSwitcher from "@/components/custom/ColorModeSwitcher.vue";

const route = useRoute();

const versionNum = "1.1.4";

const fatalError = ref<string | undefined>(undefined);
onErrorCaptured((err) => {
  fatalError.value = err instanceof Error ? err.message : String(err);
  console.error("Uncaught component error:", err);
  return false;
});
</script>

<template>
  <BackButton v-if="route.path !== '/'" />
  <div class="flex min-h-screen flex-col">
    <main class="grow">
      <ColorModeSwitcher />
      <div
        v-if="fatalError"
        class="flex flex-col items-center justify-center p-8 text-center"
      >
        <p class="text-lg font-semibold text-destructive">
          Something went wrong
        </p>
        <p class="mt-2 text-sm text-muted-foreground">{{ fatalError }}</p>
        <button class="mt-4 underline" @click="fatalError = undefined">
          Try again
        </button>
      </div>
      <RouterView v-else />
    </main>
    <footer
      class="flex h-10 items-center justify-end px-4 text-sm font-semibold text-muted-foreground"
    >
      <span class="mr-3"
        >This website is not affiliated with or endorsed by the
        <a
          class="underline hover:text-gray-300"
          href="https://www.worldcubeassociation.org/"
          >World Cube Association</a
        ></span
      >
      <span class="mr-3"
        >Made by
        <a class="underline hover:text-gray-300" href="https://nmckee.org"
          >Nicholas McKee</a
        >
      </span>
      <a
        href="https://github.com/mckeenicholas/wca-odds-next"
        class="mr-3 hover:text-gray-300"
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
