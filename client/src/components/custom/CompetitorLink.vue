<script setup lang="ts">
import { ClassValue } from "clsx";
import { computed } from "vue";
import { RouterLink } from "vue-router";
import FlagIcon from "./FlagIcon.vue";
import WCALogo from "./WCALogo.vue";

const props = defineProps<{
  name: string;
  id: string | null;
  iso2: string | null;
  class?: ClassValue;
  event?: string | null;
}>();

const wcaLink = computed(() => {
  if (!props.id) return "#";

  const url = new URL(
    `https://www.worldcubeassociation.org/persons/${props.id}`,
  );
  if (props.event) {
    url.searchParams.append("event", props.event);
  }

  return url.toString();
});

const personalLink = computed(() => {
  const base = `/rankings/personal/${props.id}`;
  if (!props.event) return base;
  const params = new URLSearchParams({ event: props.event });
  return `${base}?${params}`;
});
</script>

<template>
  <div :class="props.class" class="min-w-0">
    <FlagIcon v-if="iso2" :code="iso2" />
    <RouterLink
      :to="personalLink"
      @click.stop
      class="ms-2 min-w-0 truncate hover:underline"
    >
      {{ name }}
    </RouterLink>
    <a
      v-if="id"
      :href="wcaLink"
      target="_blank"
      class="inline-flex shrink-0 align-[-0.125em]"
    >
      <WCALogo class="ml-2 h-4 w-4" />
    </a>
  </div>
</template>
