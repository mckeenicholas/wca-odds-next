<script setup lang="ts">
import CompetitorRankDropdown from "@/components/custom/CompetitorRankDropdown.vue";
import DatePicker from "@/components/custom/DatePicker.vue";
import ErrorDisplay from "@/components/custom/ErrorPanel.vue";
import Button from "@/components/ui/button/Button.vue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { eventNames, RankingSnapshot } from "@/lib/types";
import { API_URL, renderTime } from "@/lib/utils";
import { useQuery } from "@tanstack/vue-query";
import { computed, ref } from "vue";

const selectedEvent = ref("all");
const rankDate = ref(new Date());
const committedDate = ref(new Date());

const isDirty = computed(
  () => rankDate.value.toDateString() !== committedDate.value.toDateString(),
);

const toNaiveDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const isToday = (date: Date) => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

const getRankColName = (selectedCategory: string) => {
  switch (selectedCategory) {
    case "all":
      return "Sum of Ranks";
    case "kinch":
    case "kinch_strict":
      return "Average Kinch score";
    default:
      return "Global Average";
  }
};

const formatScore = (score: number, selectedCategory: string) => {
  if (selectedCategory == "all") return score.toFixed(0);
  if (["kinch", "kinch_strict"].includes(selectedCategory))
    return score.toFixed(2);
  return renderTime(score, selectedCategory == "333fm");
};

const fetchRankings = async () => {
  const rankingsResponse = await fetch(`${API_URL}/api/rankings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_id: selectedEvent.value,
      date: isToday(committedDate.value)
        ? undefined
        : toNaiveDate(committedDate.value),
    }),
  });
  const rankingsData: RankingSnapshot[] = await rankingsResponse.json();
  return rankingsData;
};

const { isPending, isError, error, data } = useQuery({
  queryKey: computed(() => [
    "rankings",
    selectedEvent.value,
    committedDate.value.toDateString(),
  ]),
  queryFn: fetchRankings,
});

const applyDate = () => {
  committedDate.value = new Date(rankDate.value);
};
</script>

<template>
  <div class="mx-2 flex flex-col items-center justify-center pb-12">
    <h1 class="mt-4 mb-4 text-center text-2xl font-bold">Rankings</h1>

    <div class="mb-2 flex items-center justify-center space-x-4">
      <Select v-model="selectedEvent">
        <SelectTrigger class="w-64">
          <SelectValue placeholder="Event" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Global (Sum-of-Ranks)</SelectItem>
          <SelectItem value="kinch">Kinch (Competed Only)</SelectItem>
          <SelectItem value="kinch_strict"
            >Kinch (All Events Strict)</SelectItem
          >
          <div class="bg-muted my-1 h-px" />
          <SelectItem v-for="(label, id) in eventNames" :key="id" :value="id">
            {{ label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="mb-4 flex items-center gap-2">
      <span class="me-1">As of:</span>
      <DatePicker v-model="rankDate" />
      <Button v-if="isDirty" @click="applyDate" :disabled="isPending">
        Update
      </Button>
    </div>

    <div v-if="isError">
      <ErrorDisplay :error="error!.toString()" />
    </div>

    <div v-else-if="isPending" class="w-full max-w-4xl">
      <div class="mt-2 rounded-md border p-4">
        <Skeleton v-for="index in 10" :key="index" class="my-4 h-6" />
      </div>
    </div>

    <div v-else-if="data && data.length > 0" class="w-full max-w-4xl">
      <div class="mt-2 rounded-md border">
        <div class="me-8 flex justify-between p-1">
          <div class="flex-1 py-1 ps-3 text-left">Rank</div>
          <div class="flex-2 py-1 ps-1 text-left">Name</div>
          <div class="flex-1 py-1 pe-3 text-right">
            {{ getRankColName(selectedEvent) }}
          </div>
        </div>
        <hr class="mx-2" />
        <ol>
          <li
            v-for="(competitor, index) in data"
            :key="competitor.person_id"
            class="rounded-md p-1"
          >
            <CompetitorRankDropdown
              :competitor="competitor"
              :index="index"
              :selected-event="selectedEvent"
              :formatted-score="formatScore(competitor.value, selectedEvent)"
              :rank-date="committedDate"
            />
          </li>
        </ol>
      </div>
    </div>

    <div v-else class="text-muted-foreground mt-4 text-center">
      No ranking data found for the selected event and timeframe.
    </div>
  </div>
</template>
