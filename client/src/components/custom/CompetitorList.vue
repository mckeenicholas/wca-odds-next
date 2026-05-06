<script setup lang="ts">
import { computed, ref } from "vue";
import { CompetitorSimulationResult, SupportedWCAEvent } from "@/lib/types";
import CompetitorDropdown from "./CompetitorDropdown.vue";
import Chevron from "./RotatableChevron.vue";

type sortCol = "name" | "win" | "pod" | "rank";

interface groupedResults {
  idx: number;
  results: CompetitorSimulationResult;
  color: string;
}

const { simulationResults, colors, event } = defineProps<{
  simulationResults: CompetitorSimulationResult[];
  colors: string[];
  event: SupportedWCAEvent;
}>();

const sortBy = ref<sortCol>("win");
const sortAsc = ref<boolean>(false);

const headerOptions = [
  {
    id: "name",
    label: "Name",
    justify: "justify-start",
    padding: "ps-8",
    flex: "flex-[2] lg:flex-[1.5]",
  },
  {
    id: "win",
    label: "Chance of winning",
    justify: "justify-center",
    padding: "",
    flex: "flex-1",
  },
  {
    id: "pod",
    label: "Chance of podiuming",
    justify: "justify-center",
    padding: "",
    flex: "flex-1",
  },
  {
    id: "rank",
    label: "Expected rank",
    justify: "justify-center",
    padding: "",
    flex: "flex-1",
  },
] as const;

const setSortBy = (col: sortCol) => {
  if (sortBy.value === col) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortBy.value = col;
    sortAsc.value = false;
  }
};

const groupedProps = computed(() => {
  const getSortValue = (item: groupedResults): number | string => {
    switch (sortBy.value) {
      case "name":
        return item.results.name;
      case "win":
        return item.results.win_chance;
      case "pod":
        return item.results.pod_chance;
      case "rank":
        return item.results.expected_rank;
    }
  };

  const sortFn = (a: groupedResults, b: groupedResults) => {
    const aVal = getSortValue(a);
    const bVal = getSortValue(b);

    let comparison: number;
    if (typeof aVal === "string" && typeof bVal === "string") {
      comparison = aVal.localeCompare(bVal);
    } else {
      comparison = (aVal as number) - (bVal as number);
    }

    // For stats (win/pod), higher is better so default descending;
    // for rank, lower is better so also default descending (shows best first).
    // Name sorts alphabetically ascending by default.
    const defaultAsc = sortBy.value === "name" || sortBy.value === "rank";
    const effectiveAsc = defaultAsc ? !sortAsc.value : sortAsc.value;
    return effectiveAsc ? comparison : -comparison;
  };

  return simulationResults
    .map((results, idx) => ({
      idx,
      results,
      color: colors[idx],
    }))
    .sort(sortFn);
});

const model = defineModel<number[][]>({ required: true });
</script>

<template>
  <div class="mt-2 rounded-md border">
    <div class="me-8 flex justify-between p-1">
      <button
        v-for="option in headerOptions"
        :key="option.id"
        @click="setSortBy(option.id)"
        :class="[
          'flex items-center',
          option.padding,
          option.flex,
          option.justify,
        ]"
      >
        <span>{{ option.label }}</span>
        <Chevron
          v-show="sortBy === option.id"
          class="ms-1"
          :up="!sortAsc"
          :animate="false"
        />
      </button>
    </div>
    <hr class="mx-2" />
    <ol class="space-y-0.5 p-1">
      <li v-for="person in groupedProps" :key="person.results.id">
        <CompetitorDropdown
          v-model="model[person.idx]"
          :result="person.results"
          :event="event"
          :color="person.color"
        />
      </li>
    </ol>
  </div>
</template>
