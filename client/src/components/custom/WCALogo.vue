<script setup lang="ts">
import type { ClassValue } from "clsx";

const { class: className } = defineProps<{
  class?: ClassValue;
}>();
</script>

<template>
  <img
    src="/wca-logo-light.svg"
    alt="WCA Profile"
    :class="[className, 'dark:hidden']"
  />
  <img
    src="/wca-logo-dark.svg"
    alt="WCA Profile"
    :class="[className, 'hidden dark:block']"
  />
</template>
