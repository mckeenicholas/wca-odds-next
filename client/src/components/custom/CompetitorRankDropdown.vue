<script setup lang="ts">
import { LoaderCircle } from "lucide-vue-next";
import { computed, ref } from "vue";
import type { RankingSnapshot } from "@/lib/types";
import RankingsAreaChart from "@/components/charts/RankingsAreaChart.vue";
import CompetitorLink from "@/components/custom/CompetitorLink.vue";
import DateRangePicker from "@/components/custom/DateRangePicker.vue";
import RankChangeIndicator from "@/components/custom/RankChangeIndicator.vue";
import RotatableChevron from "@/components/custom/RotatableChevron.vue";
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
import { isTimeEvent } from "@/lib/utils";

const {
  competitor,
  selectedEvent,
  formattedScore,
  rankDate,
  index,
  showRegionRank,
} = defineProps<{
  competitor: RankingSnapshot;
  selectedEvent: string;
  formattedScore: string;
  rankDate: Date;
  index: number;
  showRegionRank?: boolean;
}>();

const isOpen = ref(false);

const {
  selectedDateRange,
  applyDateRange,
  hasCompleteRange,
  metric,
  detailData,
  isPending,
  isFetching,
  error,
  mappedHistory,
} = useRankDetail({
  competitorId: computed(() => competitor.person_id),
  competitorName: computed(() => competitor.name),
  eventId: computed(() => selectedEvent),
  isOpen,
  rankDate: computed(() => rankDate),
});

const ariaId = computed(() => `details-${competitor.person_id}`);
</script>

<template>
  <Collapsible v-model:open="isOpen">
    <CollapsibleTrigger as-child :aria-controls="ariaId">
      <div
        role="button"
        tabindex="0"
        :aria-label="`Details for ${competitor.person_id}`"
        class="flex w-full cursor-pointer justify-between rounded-md border-0 bg-transparent p-2 ps-1 text-left hover:bg-secondary focus:outline-none focus-visible:bg-secondary"
        :class="{ 'bg-muted/20': index % 2 === 0 }"
      >
        <div
          v-if="showRegionRank && competitor.sub_rank"
          class="w-16 shrink-0 ps-3 text-left text-xs sm:text-sm md:w-28"
        >
          <span>{{ competitor.sub_rank.rank }}</span>
          <RankChangeIndicator :change="competitor.sub_rank.rank_change" />
        </div>
        <div class="w-20 shrink-0 ps-3 text-left text-foreground md:w-28">
          <span>{{ competitor.global_rank.current }}</span>
          <RankChangeIndicator :change="competitor.global_rank.change" />
        </div>
        <div class="min-w-0 flex-2 text-left">
          <CompetitorLink
            :name="competitor.name"
            :id="competitor.person_id"
            :iso2="competitor.country_iso2"
            class="flex flex-row items-center"
          />
        </div>
        <div class="flex-1 pe-3 text-right">
          {{ formattedScore }}
        </div>
        <div class="flex w-6 shrink-0 items-center justify-end">
          <RotatableChevron :up="isOpen" />
        </div>
      </div>
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

      <div v-if="detailData?.length > 0" class="relative px-4 py-2">
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
          :isTime="isTimeEvent(selectedEvent)"
          :isFMC="selectedEvent === '333fm'"
        />
      </div>

      <div
        v-else-if="
          detailData && Array.isArray(detailData) && detailData.length === 0
        "
        class="py-4 text-center text-sm text-muted-foreground"
      >
        No history available.
      </div>

      <div class="ms-4 flex items-center gap-2 pb-2">
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

        <Button
          size="sm"
          :disabled="isFetching || !hasCompleteRange"
          @click="applyDateRange"
        >
          Update
        </Button>
      </div>

      <hr class="mx-2" />
    </CollapsibleContent>
  </Collapsible>
</template>
