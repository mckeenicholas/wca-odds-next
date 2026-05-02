<script setup lang="ts">
import { ClassValue } from "clsx";
import { computed } from "vue";
import WCALogo from "./WCALogo.vue";
import { RouterLink } from "vue-router";

const props = defineProps<{
  name: string;
  id: string | null;
  iso2: string | null;
  class?: ClassValue;
  event?: string | null;
}>();

const wcaLink = computed(() => {
  if (!props.id) return "#";

  const baseUrl = `https://www.worldcubeassociation.org/persons/${props.id}`;
  return props.event ? `${baseUrl}?event=${props.event}` : baseUrl;
});
</script>

<template>
  <div :class="[props.class, 'min-w-0']">
    <FlagIcon v-if="iso2" :code="iso2" />
    <RouterLink :to="`/rankings/personal/${id}?event=${event}`" @click.stop
      class="hover:underline me-1 truncate min-w-0">
      {{ name }}
    </RouterLink>
    <a v-if="id" :href="wcaLink" target="_blank" class="inline-flex shrink-0 [vertical-align:-0.125em]">
      <WCALogo class="ml-1 h-4 w-4" />
    </a>
  </div>
</template>