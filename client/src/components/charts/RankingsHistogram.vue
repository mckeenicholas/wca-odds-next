<script setup lang="ts">
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RankingHistoryPoint } from "@/lib/types";
import { API_URL } from "@/lib/utils";
import { useQuery } from "@tanstack/vue-query";
import { LoaderCircle } from "lucide-vue-next";
import { computed, ref } from "vue";
import MultiLabelSwitch from "./MultiLabelSwitch.vue";
import RankingsAreaChart from "./RankingsAreaChart.vue";

const props = defineProps<{
  competitors: { id: string; color: string }[];
  data: {
    event_id: string;
    start_date: string;
    end_date: string;
    kinch?: boolean;
    kinch_all_events?: boolean;
  };
}>();

const metric = ref<"value" | "rank">("rank");
const isOverlap = ref(true);

const fetchHistory = async (): Promise<RankingHistoryPoint[]> => {
  // Use top 12 competitors for visual clarity
  const slicedCompetitors = props.competitors.slice(0, 12);

  const payload = {
    competitor_ids: slicedCompetitors.map((c) => c.id),
    ...props.data,
  };

  const response = await fetch(`${API_URL}/api/rankings/history`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Error: ${response.statusText}`);
  }

  const result: RankingHistoryPoint[] = await response.json();

  return result.map((point) => ({
    ...point,
    competitors: point.competitors.map((competitor) => ({
      ...competitor,
      color:
        slicedCompetitors.find((c) => c.id === competitor.id)?.color ||
        "#ffffff",
    })),
  })) as RankingHistoryPoint[];
};

const {
  isPending,
  isError,
  error,
  data: historyData,
  refetch,
} = useQuery({
  queryKey: computed(() => [
    "rankings-history",
    props.competitors.slice(0, 12),
    props.data,
  ]),
  queryFn: fetchHistory,
  enabled: computed(() => !!props.competitors && props.competitors.length > 0),
  staleTime: Infinity,
  retry: false,
});
</script>

<template>
  <div class="ms-4 -me-6 mt-2 mb-4">
    <div class="relative min-h-75">
      <div
        v-if="isPending"
        class="flex h-75 w-full items-center justify-center"
      >
        <div class="text-muted-foreground flex flex-col items-center space-y-2">
          <LoaderCircle class="h-8 w-8 animate-spin" />
          <p class="text-sm">Generating Chart...</p>
        </div>
      </div>

      <div
        v-else-if="isError"
        class="flex h-75 w-full flex-col items-center justify-center space-y-2"
      >
        <p class="text-sm text-red-500">
          {{ error?.message || "Failed to load rankings history" }}
        </p>
        <button
          @click="refetch()"
          class="text-muted-foreground hover:text-foreground text-xs underline"
        >
          Try Again
        </button>
      </div>

      <RankingsAreaChart
        v-if="historyData"
        class="-ms-6"
        :history="historyData"
        :stacked="!isOverlap"
        :metric="metric"
        :isTime="!['all', 'kinch', 'kinch_strict'].includes(data.event_id)"
        :isFMC="data.event_id === '333fm'"
      />
      <div class="ms-12 me-6 mt-4 mb-6 flex items-center gap-2">
        <Select v-model="metric">
          <SelectTrigger class="h-8 w-45 text-xs">
            <SelectValue placeholder="Select Metric" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="value">Score</SelectItem>
            <SelectItem value="rank">Rank</SelectItem>
          </SelectContent>
        </Select>

        <MultiLabelSwitch
          class="ms-2"
          v-if="metric != 'rank'"
          left="Stacked"
          right="Overlap"
          v-model="isOverlap"
        />

        <span class="text-muted-foreground ms-auto text-xs"
          >Top 12 displayed</span
        >
      </div>
    </div>
  </div>
</template>
