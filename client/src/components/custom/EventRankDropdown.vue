<script setup lang="ts">
import { LoaderCircle } from "lucide-vue-next";
import { computed, ref } from "vue";
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
import { useRankDetail } from "@/lib/composables/useRankDetail";
import {
  type PersonRankInfo,
  type SupportedWCAEvent,
  eventNames,
} from "@/lib/types";
import { isTimeEvent, renderTime } from "@/lib/utils";
import CubingIcon from "./CubingIcon.vue";
import DateRangePicker from "./DateRangePicker.vue";
import RotatableChevron from "./RotatableChevron.vue";

const { eventRank, personId, personName, rankDate, index } = defineProps<{
  eventRank: PersonRankInfo;
  personId: string;
  personName: string;
  rankDate: Date;
  index: number;
}>();

const isOpen = ref(false);

const {
  selectedDateRange,
  applyDateRange,
  metric,
  detailData,
  isPending,
  isFetching,
  error,
  mappedHistory,
} = useRankDetail({
  competitorId: computed(() => personId),
  competitorName: computed(() => personName),
  eventId: computed(() => eventRank.event_id),
  isOpen,
  rankDate: computed(() => rankDate),
});

const eventLabel = computed(() => {
  switch (eventRank.event_id) {
    case "all":
      return "Sum of Ranks";
    case "kinch":
      return "Kinch";
    case "kinch_strict":
      return "Kinch Strict";
    default:
      return eventNames[eventRank.event_id as keyof typeof eventNames];
  }
});

const isFMC = computed(() => eventRank.event_id === "333fm");

const formatScore = (score: number) => {
  const eid = eventRank.event_id;
  if (eid === "all") return score.toFixed(0);
  if (["kinch", "kinch_strict"].includes(eid)) return score.toFixed(2);
  return renderTime(score, eid === "333fm");
};

const ariaId = computed(
  () => `event-details-${personId}-${eventRank.event_id}`,
);
</script>

<template>
  <Collapsible v-model:open="isOpen">
    <CollapsibleTrigger as-child :aria-controls="ariaId">
      <button
        type="button"
        :aria-label="`Details for ${eventLabel}`"
        class="flex w-full cursor-pointer justify-between rounded-md border-0 bg-transparent p-2 ps-1 text-left hover:bg-secondary focus:outline-none focus-visible:bg-secondary"
        :class="{ 'bg-muted/20': index % 2 === 0 }"
      >
        <div class="w-16 shrink-0 ps-3 text-left text-foreground md:w-28">
          {{ eventRank.rank }}
        </div>
        <div class="flex-2 text-left">
          <CubingIcon
            v-if="isTimeEvent(eventRank.event_id)"
            :event="eventRank.event_id as SupportedWCAEvent"
            class="me-2"
            :show-tooltip="false"
          />
          {{ eventLabel }}
        </div>
        <div class="flex-1 pe-3 text-right">
          {{ formatScore(eventRank.value) }}
        </div>
        <div class="flex w-6 shrink-0 items-center justify-end">
          <RotatableChevron :up="isOpen" />
        </div>
      </button>
    </CollapsibleTrigger>

    <CollapsibleContent class="space-y-2" :id="ariaId">
      <div v-if="isPending" class="flex justify-center py-4">
        <LoaderCircle class="h-6 w-6 animate-spin text-muted-foreground" />
      </div>

      <div
        v-else-if="error"
        class="mt-2 py-4 text-center text-sm text-destructive"
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
            class="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/50"
          >
            <LoaderCircle class="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
          <RankingsAreaChart
            :history="mappedHistory"
            :stacked="false"
            :metric="metric"
            :isTime="isTimeEvent(eventRank.event_id)"
            :isFMC="isFMC"
          />
        </div>
      </div>

      <div
        v-else-if="
          detailData && Array.isArray(detailData) && detailData.length === 0
        "
        class="py-4 text-center text-sm text-muted-foreground"
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
