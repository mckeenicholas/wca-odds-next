<script setup lang="ts">
import { BarChart } from "@/components/ui/chart-bar";
import { ChartData } from "@/lib/types";
import { computed } from "vue";
import PercentageTooltip from "./PercentageTooltip.vue";

const { data, colors } = defineProps<{ data: ChartData; colors: string[] }>();

const chartData = computed(() =>
  data.data.map((point) => {
    const result: Record<string, string | number> = { name: point.name };

    data.labels.forEach((label, index) => {
      result[label] = point.values[index];
    });

    return result;
  }),
);

console.log(chartData);
</script>

<template>
  <div class="mx-4 mt-2 mb-4">
    <BarChart
      :data="chartData"
      index="name"
      :categories="data.labels"
      :colors
      :type="'stacked'"
      :showLegend="false"
      :customTooltip="PercentageTooltip"
      :yFormatter="(tick) => `${tick}%`"
    />
  </div>
</template>
