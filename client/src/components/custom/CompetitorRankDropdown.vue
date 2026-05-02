<script setup lang="ts">
import RankingsAreaChart from "@/components/charts/RankingsAreaChart.vue";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RankingSnapshot } from "@/lib/types";
import { API_URL } from "@/lib/utils";
import { useQuery } from "@tanstack/vue-query";
import { format, subYears } from "date-fns";
import { LoaderCircle } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import DateRangePicker from "./DateRangePicker.vue";
import RotatableChevron from "./RotatableChevron.vue";
import CompetitorLink from "./CompetitorLink.vue";

const props = defineProps<{
  competitor: RankingSnapshot;
  selectedEvent: string;
  formattedScore: string;
  rankDate: Date;
  index: number;
  showRegionRank?: boolean;
}>();

const isOpen = ref(false);

const selectedDateRange = ref({
  start: subYears(props.rankDate, 1),
  end: props.rankDate,
});

const appliedDateRange = ref({
  start: subYears(props.rankDate, 1),
  end: props.rankDate,
});

watch(
  () => props.rankDate,
  (newDate) => {
    const start = subYears(newDate, 1);
    const end = newDate;

    selectedDateRange.value = { start, end };
    appliedDateRange.value = { start, end };
  },
  { immediate: true },
);

const applyDateRange = () => {
  appliedDateRange.value = { ...selectedDateRange.value };
};

const {
  data: detailData,
  isPending,
  isFetching,
  error,
} = useQuery({
  queryKey: computed(() => [
    "competitor-detail",
    props.competitor.person_id,
    props.selectedEvent,
    appliedDateRange.value.start.getTime(),
    appliedDateRange.value.end.getTime(),
  ]),
  queryFn: async () => {
    const res = await fetch(`${API_URL}/api/rankings/competitor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitor_id: props.competitor.person_id,
        event_id: props.selectedEvent,
        start_date: format(appliedDateRange.value.start, "yyyy-MM-dd"),
        end_date: format(appliedDateRange.value.end, "yyyy-MM-dd"),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to fetch details");
    }
    return res.json();
  },
  enabled: isOpen,
  staleTime: 1000 * 60 * 5,
  retry: false,
});

const ariaId = computed(() => `details-${props.competitor.person_id}`);

const metric = ref<"value" | "rank">("rank");

const mappedHistory = computed(() => {
  if (!detailData.value || !Array.isArray(detailData.value)) return [];

  return detailData.value.map((d) => ({
    date: d.snapshot_date,
    competitors: [
      {
        id: props.competitor.person_id,
        name: props.competitor.name,
        rank: d.rank,
        value: d.value,
        color: "#3b82f6",
      },
    ],
  }));
});
</script>

<template>
  <Collapsible v-model:open="isOpen">
    <CollapsibleTrigger as-child :aria-controls="ariaId">
      <div
        role="button"
        tabindex="0"
        :aria-label="`Details for ${competitor.person_id}`"
        class="hover:bg-secondary focus-visible:bg-secondary flex w-full cursor-pointer justify-between rounded-md border-0 bg-transparent p-2 ps-1 text-left focus:outline-none"
        :class="{ 'bg-muted/20': index % 2 === 0 }"
      >
        <div
          v-if="showRegionRank"
          class="w-16 shrink-0 ps-3 text-left text-xs sm:text-sm md:w-28"
        >
          {{ index + 1 }}
        </div>
        <div class="text-foreground flex-1 ps-3 text-left">
          {{ competitor.rank }}
        </div>
        <div class="min-w-0 flex-[2] text-left">
          <CompetitorLink
            :name="competitor.name"
            :id="competitor.person_id"
            :iso2="competitor.country_iso2"
            class="flex flex-row items-center gap-2"
          />
        </div>
        <div class="flex-1 pe-3 text-right">
          {{ formattedScore }}
        </div>
        <RotatableChevron :up="isOpen" />
      </div>
    </CollapsibleTrigger>

    <CollapsibleContent class="space-y-2" :id="ariaId">
      <div v-if="isPending" class="flex justify-center py-4">
        <LoaderCircle class="text-muted-foreground h-6 w-6 animate-spin" />
      </div>

      <div
        v-else-if="error"
        class="text-destructive mt-2 py-4 text-center text-sm"
      >
        {{ error.message }}
      </div>

      <div
        v-else-if="
          detailData && Array.isArray(detailData) && detailData.length > 0
        "
        class="px-4 pt-2 pb-2"
      >
        <div class="relative w-full">
          <div
            v-if="isFetching && !isPending"
            class="bg-background/50 absolute inset-0 z-10 flex items-center justify-center rounded-md"
          >
            <LoaderCircle class="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
          <RankingsAreaChart
            :history="mappedHistory"
            :stacked="false"
            :metric="metric"
            :isTime="!['all', 'kinch', 'kinch_strict'].includes(selectedEvent)"
            :isFMC="selectedEvent === '333fm'"
          />
        </div>
      </div>

      <div
        v-else-if="
          detailData && Array.isArray(detailData) && detailData.length === 0
        "
        class="text-muted-foreground py-4 text-center text-sm"
      >
        No history available.
      </div>

      <div class="ms-4 flex items-center space-x-2 pb-2">
        <Select v-model="metric">
          <SelectTrigger class="w-32 text-xs">
            <SelectValue placeholder="Select Metric" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="value">Result</SelectItem>
            <SelectItem value="rank">Rank</SelectItem>
          </SelectContent>
        </Select>
        <DateRangePicker
          v-model:start-date="selectedDateRange.start"
          v-model:end-date="selectedDateRange.end"
          :allow-future="false"
        />
        <Button size="sm" @click="applyDateRange" :disabled="isFetching">
          Update
        </Button>
      </div>

      <hr class="mx-2" />
    </CollapsibleContent>
  </Collapsible>
</template>
