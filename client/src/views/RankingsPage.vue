<script setup lang="ts">
import CompetitorRankDropdown from "@/components/custom/CompetitorRankDropdown.vue";
import CountryFilterButton from "@/components/custom/CountryFilterButton.vue";
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
import {
  eventNames,
  type CountryResult,
  type RankingSnapshot,
} from "@/lib/types";
import { API_URL, renderTime } from "@/lib/utils";
import { useInfiniteQuery } from "@tanstack/vue-query";
import { LoaderCircle } from "lucide-vue-next";
import { computed, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const PAGE_SIZE = 32;
const MAX_ITEMS = 512;

const selectedEvent = ref("all");
const rankDate = ref(new Date());
const committedDate = ref(new Date());
const selectedCountry = ref<CountryResult | null>(null);

const isDirty = computed(
  () => rankDate.value.toDateString() !== committedDate.value.toDateString(),
);

const toNaiveDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const isToday = (date: Date) => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

watch(
  () => route.query.date,
  (newDate) => {
    if (newDate && typeof newDate === "string") {
      const [year, month, day] = newDate.split("-");
      if (year && month && day) {
        const d = new Date(Number(year), Number(month) - 1, Number(day));
        if (!isNaN(d.getTime())) {
          rankDate.value = d;
          committedDate.value = d;
        }
      }
    } else {
      rankDate.value = new Date();
      committedDate.value = new Date();
    }
  },
  { immediate: true },
);

watch(
  () => route.query.event,
  (newEvent) => {
    if (newEvent && typeof newEvent === "string") {
      selectedEvent.value = newEvent;
    } else {
      selectedEvent.value = "all";
    }
  },
  { immediate: true },
);

const updateUrl = () => {
  const query: Record<string, string> = {};
  if (!isToday(committedDate.value)) {
    query.date = toNaiveDate(committedDate.value);
  }
  if (selectedEvent.value !== "all") {
    query.event = selectedEvent.value;
  }
  // Preserve country if we add it later
  router.push({ query });
};

watch(selectedEvent, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    updateUrl();
  }
});

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

const queryKey = computed(() => [
  "rankings",
  selectedEvent.value,
  committedDate.value.toDateString(),
  selectedCountry.value?.id ?? "all",
]);

const {
  isPending,
  isError,
  error,
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteQuery({
  queryKey,
  queryFn: async ({ pageParam }) => {
    const res = await fetch(`${API_URL}/api/rankings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: selectedEvent.value,
        date: isToday(committedDate.value)
          ? undefined
          : toNaiveDate(committedDate.value),
        country_id: selectedCountry.value?.id ?? undefined,
        offset: pageParam,
      }),
    });
    const page: RankingSnapshot[] = await res.json();
    return page;
  },
  initialPageParam: 0,
  getNextPageParam: (lastPage, allPages) => {
    const totalLoaded = allPages.flat().length;
    if (lastPage.length < PAGE_SIZE || totalLoaded >= MAX_ITEMS)
      return undefined;
    return totalLoaded;
  },
});

const allItems = computed(() => data.value?.pages.flat() ?? []);

// Infinite scroll sentinel
const sentinelRef = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

watch(sentinelRef, (el) => {
  observer?.disconnect();
  if (!el) return;
  observer = new IntersectionObserver(
    (entries) => {
      if (
        entries[0].isIntersecting &&
        hasNextPage.value &&
        !isFetchingNextPage.value
      ) {
        fetchNextPage();
      }
    },
    { threshold: 0.1 },
  );
  observer.observe(el);
});

onUnmounted(() => observer?.disconnect());

const applyDate = () => {
  committedDate.value = new Date(rankDate.value);
  updateUrl();
};

const setToday = () => {
  rankDate.value = new Date();
  applyDate();
};
</script>

<template>
  <div class="mx-2 flex flex-col items-center justify-center pb-12">
    <h1 class="mt-4 mb-4 text-center text-2xl font-bold">Rankings</h1>

    <div class="mb-2 flex flex-wrap items-center justify-center gap-2">
      <Select v-model="selectedEvent">
        <SelectTrigger class="w-64">
          <SelectValue placeholder="Event" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Global (Sum-of-Ranks)</SelectItem>
          <SelectItem value="kinch">Kinch (Competed Only)</SelectItem>
          <SelectItem value="kinch_strict">Kinch (All Events Strict)</SelectItem>
          <div class="bg-muted my-1 h-px" />
          <SelectItem v-for="(label, id) in eventNames" :key="id" :value="id">
            {{ label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <CountryFilterButton v-model="selectedCountry" :include-regions="true" />
    </div>

    <div class="mb-4 flex flex-col items-center gap-2">
      <div class="flex items-center gap-2">
        <DatePicker v-model="rankDate" :allow-future="false" />
      </div>
      <div class="flex h-9 items-center gap-2">
        <Button v-if="!isToday(rankDate)" @click="setToday" variant="outline" :disabled="isPending">
          Today
        </Button>
        <Button v-if="isDirty" @click="applyDate" :disabled="isPending">
          Update
        </Button>
      </div>
    </div>

    <div v-if="isError">
      <ErrorDisplay :error="error!.toString()" />
    </div>

    <div v-else-if="isPending" class="w-full max-w-4xl">
      <div class="rounded-md border px-4">
        <Skeleton v-for="index in 10" :key="index" class="my-4 h-9" />
      </div>
    </div>

    <div v-else-if="allItems.length > 0" class="w-full max-w-4xl">
      <div class="mt-2 rounded-md border">
        <div class="flex w-full justify-between p-2 ps-1 text-muted-foreground text-sm font-medium">
          <div v-if="selectedCountry" class="w-16 shrink-0 ps-3 text-left md:w-28">
            Region Rank
          </div>
          <div class="flex-1 ps-3 text-left">
            {{ selectedCountry ? "Global Rank" : "Rank" }}
          </div>
          <div class="flex-[2] min-w-0 text-left">Name</div>
          <div class="flex-1 pe-3 text-right">
            {{ getRankColName(selectedEvent) }}
          </div>
          <div class="w-6"></div>
        </div>
        <hr class="mx-2" />
        <ol>
          <li v-for="(competitor, index) in allItems" :key="competitor.person_id" class="rounded-md p-1">
            <CompetitorRankDropdown :competitor="competitor" :index="index" :selected-event="selectedEvent"
              :formatted-score="formatScore(competitor.value, selectedEvent)" :rank-date="committedDate"
              :show-region-rank="!!selectedCountry" />
          </li>
        </ol>

        <!-- Infinite scroll sentinel -->
        <div ref="sentinelRef" class="h-1" />

        <!-- Loading more indicator -->
        <div v-if="isFetchingNextPage" class="flex justify-center py-4">
          <LoaderCircle class="text-muted-foreground h-5 w-5 animate-spin" />
        </div>

        <!-- End of results -->
        <div v-else-if="!hasNextPage && allItems.length > PAGE_SIZE"
          class="text-muted-foreground py-3 text-center text-sm">
          Showing all {{ allItems.length }} results
        </div>
      </div>
    </div>

    <div v-else class="text-muted-foreground mt-4 text-center">
      No ranking data found for the selected event and timeframe.
    </div>
  </div>
</template>
