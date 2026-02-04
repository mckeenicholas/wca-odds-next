<script setup lang="ts">
import PieChart from "@/components/charts/PieChart.vue";
import {
  SimulationAPIResults,
  SupportedWCAEvent,
  eventNames,
} from "@/lib/types";
import { formatPercentage, toClockFormat } from "@/lib/utils";
import { computed } from "vue";

const { data, colors, event } = defineProps<{
  data: SimulationAPIResults;
  colors: string[];
  event: SupportedWCAEvent;
}>();

const topCompetitor = computed(() =>
  data.competitor_results.reduce(
    (max, competitor) =>
      competitor.win_chance > max.win_chance ? competitor : max,
    data.competitor_results[0],
  ),
);

const topCompetitorStats = computed(() => ({
  avgRank: topCompetitor.value.expected_rank.toFixed(2),
  winChance: formatPercentage(topCompetitor.value.win_chance, true),
  podiumChance: formatPercentage(topCompetitor.value.pod_chance, true),
  expectedAvg: toClockFormat(topCompetitor.value.mean_no_dnf),
}));
</script>

<template>
  <div class="mb-2 flex h-full flex-col gap-2 md:flex-row">
    <div class="grow">
      <div class="h-full rounded-md border p-4">
        <p class="mb-2 text-lg font-bold">{{ eventNames[event] }} Statistics</p>
        <div class="space-y-2">
          <p class="text-sm">
            <span class="font-semibold">{{ topCompetitor.name }}</span> has the
            highest odds of winning with:
          </p>
          <ul class="ml-4 list-inside list-disc text-sm">
            <li>{{ topCompetitorStats.winChance }} chance of winning</li>
            <li>
              {{ topCompetitorStats.podiumChance }} chance of podium finish
            </li>
            <li>Average rank of {{ topCompetitorStats.avgRank }}</li>
            <li>Expected average of {{ topCompetitorStats.expectedAvg }}</li>
          </ul>
        </div>
      </div>
    </div>
    <div class="rounded-md border p-2">
      <PieChart :data :colors />
    </div>
  </div>
</template>
