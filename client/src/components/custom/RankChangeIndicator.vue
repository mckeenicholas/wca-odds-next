<script setup lang="ts">
defineProps<{
  change: number | null;
}>();
</script>

<template>
  <span
    v-if="change != null"
    class="ms-2 inline-flex items-center gap-px text-xs"
    :class="{
      'text-green-500': change > 0,
      'text-red-500': change < 0,
      'text-muted-foreground': change === 0,
    }"
  >
    <svg v-if="change > 0" class="h-2 w-2" viewBox="0 0 10 10">
      <polygon points="5,0 10,10 0,10" fill="currentColor" />
    </svg>
    <svg v-else-if="change < 0" class="h-2 w-2" viewBox="0 0 10 10">
      <polygon points="0,0 10,0 5,10" fill="currentColor" />
    </svg>
    <svg v-else class="h-2 w-2" viewBox="0 0 10 10">
      <rect x="0" y="4" width="10" height="2" fill="currentColor" />
    </svg>
    <span v-if="change !== 0" class="ms-0.5 text-[10px]">{{
      Math.abs(change)
    }}</span>
  </span>
</template>
