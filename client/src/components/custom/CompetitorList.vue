<script setup lang="ts">
import { SimulationAPIResultItem, SupportedWCAEvent } from "@/lib/types";
import { computed, ref } from "vue";
import CompetitorDropdown from "./CompetitorDropdown.vue";
import Chevron from "./RotatableChevron.vue";

type sortCol = "name" | "win" | "pod" | "rank";

interface groupedResults {
  idx: number;
  results: SimulationAPIResultItem;
  color: string;
}

const { simulationResults, colors, event } = defineProps<{
  simulationResults: SimulationAPIResultItem[];
  colors: string[];
  event: SupportedWCAEvent;
}>();

const sortBy = ref<sortCol>("win");
const sortAsc = ref<boolean>(false);

const headerOptions = [
  { id: "name", label: "Name", justify: "justify-start", padding: "ps-3" },
  {
    id: "win",
    label: "Chance of winning",
    justify: "justify-center",
    padding: "",
  },
  {
    id: "pod",
    label: "Chance of podiuming",
    justify: "justify-center",
    padding: "",
  },
  {
    id: "rank",
    label: "Expected rank",
    justify: "justify-center",
    padding: "",
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
  const sortFn = (a: groupedResults, b: groupedResults) => {
    const comparison =
      sortBy.value === "name"
        ? -a.results.name.localeCompare(b.results.name) // This is inverted to be consistent as we sort by descending for stats
        : sortBy.value === "win"
          ? a.results.win_chance - b.results.win_chance
          : sortBy.value === "pod"
            ? a.results.pod_chance - b.results.pod_chance
            : -(a.results.expected_rank - b.results.expected_rank); // This is also inverted for the same reason as above

    return sortAsc.value ? comparison : -comparison;
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
        class="hover:bg-secondary flex-1 rounded-md px-2 py-1"
        :class="option.padding"
      >
        <div class="flex items-center" :class="option.justify">
          <span>{{ option.label }}</span>
          <Chevron
            v-show="sortBy === option.id"
            class="ms-1"
            :up="!sortAsc"
            :animate="false"
          />
        </div>
      </button>
    </div>
    <hr class="mx-2" />
    <ol>
      <li
        v-for="(person, idx) in groupedProps"
        :key="idx"
        class="rounded-md p-1"
      >
        <CompetitorDropdown
          :result="person.results"
          :event
          :color="person.color"
          v-model="model[person.idx]"
        />
      </li>
    </ol>
  </div>
</template>
