<script setup lang="ts">
import { useColorMode } from "@vueuse/core";
import type { ClassValue } from "clsx";
import { computed } from "vue";

const props = defineProps<{
  class?: ClassValue;
}>();

const mode = useColorMode();

const src = computed(() => {
  if (mode.value == "dark") {
    return "/wca-logo-dark.svg";
  }
  return "/wca-logo-light.svg";
});
</script>

<template>
  <img :src="src" alt="WCA Profile" :class="props.class" />
</template>
