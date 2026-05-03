<script setup lang="ts">
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HistoryChartMetric, HistoryPoint } from "@/lib/types";
import { API_URL } from "@/lib/utils";
import { useQuery } from "@tanstack/vue-query";
import { LoaderCircle } from "lucide-vue-next";
import { computed, ref } from "vue";
import MultiLabelSwitch from "./MultiLabelSwitch.vue";
import StackedAreaChart from "./StackedAreaChart.vue";

const props = defineProps<{
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
    competitor_ids: props.competitors.map((c) => c.id),
    ...props.data,
  };

  const response = await fetch(`${API_URL}/api/history`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Error: ${response.statusText}`);
  }

  const result: HistoryPoint[] = await response.json();

  return result.map((point) => ({
    ...point,
    competitors: point.competitors.map((competitor) => ({
      ...competitor,
      color: props.competitors.find((c) => c.id === competitor.id)!.color,
    })),
  })) as HistoryPoint[];
};

const { isPending, isError, error, data, refetch } = useQuery({
  queryKey: computed(() => [
    "simulation-history",
    props.competitors,
    props.data,
  ]),
  queryFn: fetchHistory,
  enabled: computed(() => !!props.competitors && props.competitors.length > 0),
  staleTime: Infinity,
  retry: false,
});

const chartData = computed(() => {
  if (!data.value) return null;

  return data.value.map((point) => ({
    ...point,
    competitors: point.competitors.map((c) => {
      let value = 0;

      if (metric.value === "win") {
        value = c.win_chance * 100;
      } else if (metric.value === "podium") {
        value = c.pod_chance * 100;
      } else if (metric.value === "rank") {
        value = c.expected_rank;
      }

      return {
        ...c,
        displayValue: value,
      };
    }),
  }));
});
</script>

<template>
  <div class="w-full py-4">
    <div class="relative min-h-75">
      <div
        v-if="isPending"
        class="bg-background/50 absolute inset-0 z-10 flex flex-col items-center justify-center space-y-2"
      >
        <LoaderCircle class="text-muted-foreground h-8 w-8 animate-spin" />
        <p class="text-muted-foreground text-sm">Generating...</p>
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
          class="text-muted-foreground hover:text-foreground text-xs underline"
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
