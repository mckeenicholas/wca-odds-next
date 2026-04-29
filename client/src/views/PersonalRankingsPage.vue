<script setup lang="ts">
import DatePicker from "@/components/custom/DatePicker.vue";
import ErrorDisplay from "@/components/custom/ErrorPanel.vue";
import EventRankDropdown from "@/components/custom/EventRankDropdown.vue";
import FlagIcon from "@/components/custom/FlagIcon.vue";
import Button from "@/components/ui/button/Button.vue";
import { Skeleton } from "@/components/ui/skeleton";
import {
  eventOrder,
  SupportedWCAEvent,
  type PersonRankInfo,
  type PersonSearchResult,
} from "@/lib/types";
import { API_URL } from "@/lib/utils";
import { useQuery } from "@tanstack/vue-query";
import { onClickOutside, useDebounceFn } from "@vueuse/core";
import { LoaderCircle, Search, X } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import "../style.css";

const route = useRoute();
const router = useRouter();

const searchTerm = ref("");
const debouncedTerm = ref("");
const selectedPerson = ref<PersonSearchResult | null>(null);
const dropdownOpen = ref(false);
const searchInputRef = ref<HTMLInputElement | null>(null);
const comboboxRef = ref<HTMLElement | null>(null);

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

const debouncedSearch = useDebounceFn((term: string) => {
  debouncedTerm.value = term;
}, 300);

watch(searchTerm, (val) => {
  debouncedSearch(val);
  if (val.trim().length >= 2) {
    dropdownOpen.value = true;
  }
});

// Close dropdown on click outside
onClickOutside(comboboxRef, () => {
  dropdownOpen.value = false;
});

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
  () => route.params.id,
  async (newId) => {
    if (newId && newId !== selectedPerson.value?.person_id) {
      try {
        const res = await fetch(
          `${API_URL}/api/search?q=${encodeURIComponent(newId as string)}`,
        );
        const data = await res.json();
        if (data.length > 0) {
          selectedPerson.value = data[0];
        } else {
          selectedPerson.value = null;
        }
      } catch (e) {
        console.error(e);
      }
    } else if (!newId) {
      selectedPerson.value = null;
    }
  },
  { immediate: true },
);

// Search people
const { data: searchResults, isFetching: isSearching } = useQuery({
  queryKey: computed(() => ["person-search", debouncedTerm.value]),
  queryFn: async () => {
    const res = await fetch(
      `${API_URL}/api/search?q=${encodeURIComponent(debouncedTerm.value)}`,
    );
    if (!res.ok) throw new Error("Search failed");
    return res.json() as Promise<PersonSearchResult[]>;
  },
  enabled: computed(() => debouncedTerm.value.trim().length >= 2),
  staleTime: 1000 * 60 * 2,
});

const showResults = computed(() => debouncedTerm.value.trim().length >= 2);

const getEventOrder = (event: string) => {
  switch (event) {
    case "all":
      return -3;
    case "kinch":
      return -2;
    case "kinch_strict":
      return -1;
    default:
      return eventOrder[event as SupportedWCAEvent];
  }
};

const selectPerson = (person: PersonSearchResult) => {
  selectedPerson.value = person;
  dropdownOpen.value = false;
  searchTerm.value = "";
  debouncedTerm.value = "";
  router.push({
    path: `/rankings/personal/${person.person_id}`,
    query: isToday(committedDate.value)
      ? undefined
      : { date: toNaiveDate(committedDate.value) },
  });
};

const clearPerson = () => {
  selectedPerson.value = null;
  searchTerm.value = "";
  debouncedTerm.value = "";
  searchInputRef.value?.focus();
  router.push({ path: "/rankings/personal", query: route.query });
};

// Fetch personal rankings
const {
  data: rankData,
  isPending: isRankPending,
  isError,
  error,
} = useQuery({
  queryKey: computed(() => [
    "personal-rankings",
    selectedPerson.value?.person_id,
    committedDate.value.toDateString(),
  ]),
  queryFn: async () => {
    const res = await fetch(`${API_URL}/api/persons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        person_id: selectedPerson.value!.person_id,
        date: isToday(committedDate.value)
          ? undefined
          : toNaiveDate(committedDate.value),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to fetch rankings");
    }
    const res_data = (await res.json()) as PersonRankInfo[];

    res_data.sort(
      (a, b) => getEventOrder(a.event_id) - getEventOrder(b.event_id),
    );
    return res_data;
  },
  enabled: computed(() => !!selectedPerson.value),
  staleTime: 1000 * 60 * 5,
});

const applyDate = () => {
  committedDate.value = new Date(rankDate.value);
  router.push({
    path: selectedPerson.value
      ? `/rankings/personal/${selectedPerson.value.person_id}`
      : "/rankings/personal",
    query: isToday(committedDate.value)
      ? undefined
      : { date: toNaiveDate(committedDate.value) },
  });
};

const setToday = () => {
  rankDate.value = new Date();
  applyDate();
};
</script>

<template>
  <div class="mx-2 flex flex-col items-center justify-center pb-12">
    <h1 class="mt-4 mb-4 text-center text-2xl font-bold">Personal Rankings</h1>

    <div class="mb-2 flex flex-wrap items-center justify-center gap-2">
      <!-- Person Search (inline autocomplete) -->
      <div ref="comboboxRef" class="relative w-72">
        <div
          class="border-input bg-background ring-offset-background flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <Search class="text-muted-foreground h-4 w-4 shrink-0" />
          <template v-if="selectedPerson">
            <div class="flex flex-1 items-center gap-2 truncate">
              <FlagIcon
                v-if="selectedPerson.country_iso2"
                :code="selectedPerson.country_iso2"
              />
              <span class="truncate">{{ selectedPerson.name }}</span>
              <span class="text-muted-foreground text-xs"
                >({{ selectedPerson.person_id }})</span
              >
            </div>
            <button
              @click="clearPerson"
              class="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer transition-colors"
              aria-label="Clear selection"
            >
              <X class="h-4 w-4" />
            </button>
          </template>
          <input
            v-else
            ref="searchInputRef"
            v-model="searchTerm"
            placeholder="Search for a person..."
            class="placeholder:text-muted-foreground flex-1 bg-transparent outline-none"
          />
        </div>

        <!-- Dropdown results -->
        <div
          v-if="
            dropdownOpen &&
            !selectedPerson &&
            ((searchResults?.length ?? 0) > 0 || isSearching)
          "
          class="bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 absolute z-50 mt-1 w-full rounded-md border shadow-md"
        >
          <div class="no-scrollbar max-h-64 overflow-y-scroll p-1">
            <!-- Loading -->
            <div
              v-if="isSearching && showResults"
              class="flex items-center justify-center py-4"
            >
              <LoaderCircle
                class="text-muted-foreground h-5 w-5 animate-spin"
              />
            </div>
            <!-- Results -->
            <template
              v-else-if="
                showResults && searchResults && searchResults.length > 0
              "
            >
              <button
                v-for="person in searchResults"
                :key="person.person_id"
                @click="selectPerson(person)"
                class="hover:bg-accent hover:text-accent-foreground flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors"
              >
                <FlagIcon
                  v-if="person.country_iso2"
                  :code="person.country_iso2"
                />
                <span class="truncate">{{ person.name }}</span>
                <span class="text-muted-foreground ms-auto shrink-0 text-xs">
                  {{ person.person_id }}
                </span>
              </button>
            </template>
            <!-- No results -->
            <div
              v-else-if="
                showResults && searchResults && searchResults.length === 0
              "
              class="text-muted-foreground py-4 text-center text-sm"
            >
              No results found.
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mb-4 flex flex-col items-center gap-2">
      <div class="flex items-center gap-2">
        <DatePicker
          v-model="rankDate"
          :disabled="!selectedPerson"
          :allow-future="false"
        />
      </div>
      <div class="flex h-9 items-center gap-2">
        <Button
          v-if="!isToday(rankDate)"
          @click="setToday"
          variant="outline"
          :disabled="isRankPending"
        >
          Today
        </Button>
        <Button v-if="isDirty" @click="applyDate" :disabled="isRankPending">
          Update
        </Button>
      </div>
    </div>

    <!-- Error -->
    <div v-if="isError">
      <ErrorDisplay :error="error!.toString()" />
    </div>

    <template v-if="selectedPerson">
      <!-- Loading -->
      <div v-if="isRankPending" class="w-full max-w-4xl">
        <div class="rounded-md border px-4">
          <Skeleton v-for="index in 10" :key="index" class="my-4 h-9" />
        </div>
      </div>

      <!-- Results -->
      <div v-if="rankData && rankData.length > 0" class="w-full max-w-4xl">
        <div class="mt-2 rounded-md border">
          <div class="me-8 flex justify-between p-1">
            <div class="w-16 shrink-0 py-1 ps-3 text-left md:w-28">Rank</div>
            <div class="flex-2 py-1 ps-1 text-left">Event</div>
            <div class="flex-1 py-1 pe-3 text-right">Score</div>
          </div>
          <hr class="mx-2" />
          <ol>
            <li
              v-for="(eventRank, index) in rankData"
              :key="eventRank.event_id"
              class="rounded-md p-1"
            >
              <EventRankDropdown
                :event-rank="eventRank"
                :person-id="selectedPerson.person_id"
                :person-name="selectedPerson.name"
                :rank-date="committedDate"
                :index="index"
              />
            </li>
          </ol>
        </div>
      </div>

      <div
        v-else-if="selectedPerson && rankData && rankData.length === 0"
        class="text-muted-foreground mt-4 text-center"
      >
        {{ selectedPerson.name }} has not competed in the given timeframe.
      </div>
    </template>
  </div>
</template>

<style lang="css" scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  scrollbar-width: none;
}
</style>
