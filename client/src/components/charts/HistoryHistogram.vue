<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { LoaderCircle } from "lucide-vue-next";
import { computed, ref } from "vue";
import type { HistoryChartMetric, HistoryPoint } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_URL } from "@/lib/utils";
import MultiLabelSwitch from "./MultiLabelSwitch.vue";
import StackedAreaChart from "./StackedAreaChart.vue";

const { competitors, data } = defineProps<{
  competitors: { id: string; color: string }[];
  data: {
    event_id: string;
    start_date: string;
    end_date: string;
    half_life: number;
    include_dnf: boolean;
  };
}>();

const metric = ref<HistoryChartMetric>("win");
const isOverlap = ref(false);

const fetchHistory = async (): Promise<HistoryPoint[]> => {
  const payload = {
    competitor_ids: competitors.map((c) => c.id),
    ...data,
  };

  const response = await fetch(`${API_URL}/api/history`, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Error: ${response.statusText}`);
  }

  const result: HistoryPoint[] = await response.json();

  for (const point of result) {
    for (const competitor of point.competitors) {
      (competitor as HistoryPoint["competitors"][number]).color =
        competitors.find((c) => c.id === competitor.id)!.color;
    }
  }

  return result;
};

const {
  isPending,
  isError,
  error,
  data: historyData,
  refetch,
} = useQuery({
  enabled: computed(() => Boolean(competitors) && competitors.length > 0),
  queryFn: fetchHistory,
  queryKey: computed(() => ["simulation-history", competitors, data]),
  retry: false,
  staleTime: Infinity,
});

const chartData = computed(() => {
  if (!historyData.value) return undefined;

  return historyData.value.map((point) => {
    const competitorList = point.competitors.map((c) => {
      let value = 0;

      if (metric.value === "win") {
        value = c.win_chance * 100;
      } else if (metric.value === "podium") {
        value = c.pod_chance * 100;
      } else if (metric.value === "rank") {
        value = c.expected_rank;
      }

      return Object.assign({}, c, { displayValue: value });
    });

    return Object.assign({}, point, { competitors: competitorList });
  });
});
</script>

<template>
  <div class="w-full py-4">
    <div class="relative min-h-75">
      <div
        v-if="isPending"
        class="absolute inset-0 z-10 flex flex-col items-center justify-center space-y-2 bg-background/50"
      >
        <LoaderCircle class="h-8 w-8 animate-spin text-muted-foreground" />
        <p class="text-sm text-muted-foreground">Generating...</p>
      </div>
      <div
        v-else-if="isError"
        class="flex h-75 w-full flex-col items-center justify-center gap-2 rounded-md border"
      >
        <p class="text-sm text-red-500">
          {{ error?.message || "Failed to load history" }}
        </p>
        <button
          @click="refetch()"
          class="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Try Again
        </button>
      </div>
      <template v-if="chartData">
        <StackedAreaChart
          :history="chartData"
          :stacked="!isOverlap"
          :metric="metric"
          class="h-75 w-full"
        />
        <div class="mt-6 flex flex-wrap items-center gap-4 px-2">
          <Select v-model="metric">
            <SelectTrigger class="h-8 w-44 text-xs">
              <SelectValue placeholder="Select Metric" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="win">Win Probability</SelectItem>
              <SelectItem value="podium">Podium Probability</SelectItem>
              <SelectItem value="rank">Expected Rank</SelectItem>
            </SelectContent>
          </Select>

          <MultiLabelSwitch
            v-if="metric !== 'rank'"
            left="Stacked"
            right="Overlap"
            v-model="isOverlap"
          />
        </div>
      </template>
    </div>
  </div>
</template>
