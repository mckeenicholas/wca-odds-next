<script setup lang="ts">
import { DonutChart } from "@/components/ui/chart-donut";
import { SimulationAPIResults } from "@/lib/types";
import { computed } from "vue";
import PercentageTooltip from "./PercentageTooltip.vue";

const { data, colors } = defineProps<{
  data: SimulationAPIResults;
  colors: string[];
}>();

const chartData = computed(() =>
  data.competitor_results.map((item) => ({
    name: item.name,
    wins: item.win_chance * 100,
  })),
);
</script>

<template>
  <div class="max-w-96">
    <DonutChart
      index="name"
      :category="'wins'"
      :data="chartData"
      :type="'pie'"
      :colors
      :custom-tooltip="PercentageTooltip"
    />
  </div>
</template>
