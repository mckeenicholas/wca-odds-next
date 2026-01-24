<script setup lang="ts">
import ColoredCircle from "@/components/custom/ColoredCircle.vue";
import { renderTime } from "@/lib/utils";

export interface ResultChartTooltipProps {
  title?: string;
  data: {
    name: string;
    color: string;
    value: number;
  }[];
  isFmc?: boolean;
}

const { title, data, isFmc = false } = defineProps<ResultChartTooltipProps>();

const timeRawValue = parseInt(title ?? "0") * 10;
const timeDisplayValue = renderTime(timeRawValue, isFmc);
</script>

<template>
  <div class="rounded-md p-2">
    <p class="font-bold">{{ timeDisplayValue }}</p>
    <div v-for="(item, key) in data" :key class="flex justify-between text-sm">
      <div class="flex items-center">
        <span class="mr-2 h-2.5 w-2.5">
          <ColoredCircle :color="item.color" />
        </span>
        <span>{{ item.name }}</span>
      </div>
      <span class="ml-4 font-semibold"
        >{{ item.value >= 0.01 ? item.value.toFixed(2) : "<0.01" }}%</span
      >
    </div>
  </div>
</template>
