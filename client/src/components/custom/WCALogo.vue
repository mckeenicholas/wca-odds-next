<script setup lang="ts">
import type { ClassValue } from "clsx";

const props = defineProps<{
  class?: ClassValue;
}>();
</script>

<template>
  <img
    src="/wca-logo-light.svg"
    alt="WCA Profile"
    :class="[props.class, 'dark:hidden']"
  />
  <img
    src="/wca-logo-dark.svg"
    alt="WCA Profile"
    :class="[props.class, 'hidden dark:block']"
  />
</template>
