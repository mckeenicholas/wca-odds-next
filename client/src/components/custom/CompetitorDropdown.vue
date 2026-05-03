<script setup lang="ts">
import IndividualHistogram from "@/components/charts/IndividualHistogram.vue";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CompetitorSimulationResult,
  eventAttempts,
  SupportedWCAEvent,
} from "@/lib/types";
import { formatPercentage } from "@/lib/utils";
import { CircleAlert } from "lucide-vue-next";
import { computed, ref } from "vue";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import ColoredCircle from "./ColoredCircle.vue";
import CompetitorLink from "./CompetitorLink.vue";
import FMCEntryField from "./FMCEntryField.vue";
import Chevron from "./RotatableChevron.vue";
import ResultEntryField from "./TimeEntryField.vue";

const lowDataWarningThreshold = 12 as const;

const { result, color, event } = defineProps<{
  result: CompetitorSimulationResult;
  color: string;
  event: SupportedWCAEvent;
}>();

const model = defineModel<number[]>({ required: true });

const isOpen = ref<boolean>(false);

const winPercentage = computed(() => formatPercentage(result.win_chance * 100));
const podiumPercentage = computed(() =>
  formatPercentage(result.pod_chance * 100),
);
const expectedRank = computed(() => result.expected_rank.toFixed(4));

const ariaId = computed(() => `dropdown-${result.id}`);
</script>

<template>
  <Collapsible v-model:open="isOpen">
    <CollapsibleTrigger as-child :aria-controls="ariaId">
      <button
        type="button"
        :aria-label="`Details for ${result.id}`"
        class="hover:bg-secondary focus-visible:bg-secondary flex w-full items-center justify-between rounded-md p-2 ps-1 text-left focus:outline-none"
      >
        <div class="flex min-w-0 flex-2 items-center gap-3 lg:flex-[1.5]">
          <ColoredCircle :color class="ms-2" />

          <CompetitorLink
            :name="result.name"
            :id="result.id"
            :iso2="result.country_iso2"
            :event="event"
            class="flex items-center"
          />

          <TooltipProvider
            v-if="result.sample_size < lowDataWarningThreshold"
            :delayDuration="250"
          >
            <Tooltip>
              <TooltipTrigger aria-label="Low result warning tooltip">
                <CircleAlert class="scale-75 text-red-600" />
              </TooltipTrigger>
              <TooltipContent>
                Competitor only has performed {{ result.sample_size }} solves
                since date cutoff.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div class="flex-1 text-center">{{ winPercentage }}</div>
        <div class="flex-1 text-center">{{ podiumPercentage }}</div>
        <div class="flex-1 text-center">{{ expectedRank }}</div>
        <Chevron :up="isOpen" />
      </button>
    </CollapsibleTrigger>
    <CollapsibleContent :id="ariaId" class="space-y-2">
      <IndividualHistogram :color :data="result.histogram" :event />
      <div class="flex flex-wrap items-center gap-2 px-2 lg:ms-2 lg:gap-4">
        <div
          v-for="attemptIdx in eventAttempts[event]"
          :key="attemptIdx"
          class="flex items-center gap-2"
        >
          <span class="text-sm whitespace-nowrap"
            >Attempt {{ attemptIdx }}:</span
          >
          <div class="lg:max-w-24">
            <ResultEntryField
              v-if="event !== '333fm'"
              v-model="model[attemptIdx - 1]"
            />
            <FMCEntryField v-else v-model="model[attemptIdx - 1]" />
          </div>
        </div>
      </div>
      <hr class="mx-2" />
    </CollapsibleContent>
  </Collapsible>
</template>
