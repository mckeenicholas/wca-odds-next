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
  <div class="mx-auto flex w-full max-w-4xl flex-col items-center px-4 pb-12">
    <h1 class="my-6 text-2xl font-bold">Personal Rankings</h1>
    <div class="mb-6 flex w-full flex-col items-center gap-4">
      <div ref="comboboxRef" class="relative w-full max-w-md">
        <div
          class="border-input bg-background ring-offset-background focus-within:ring-ring flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-sm focus-within:ring-2"
        >
          <Search class="text-muted-foreground h-4 w-4 shrink-0" />
          <template v-if="selectedPerson">
            <div class="flex flex-1 items-center gap-2 truncate">
              <FlagIcon
                v-if="selectedPerson.country_iso2"
                :code="selectedPerson.country_iso2"
              />
              <span class="truncate font-medium">{{
                selectedPerson.name
              }}</span>
              <span class="text-muted-foreground text-xs"
                >({{ selectedPerson.person_id }})</span
              >
            </div>
            <button
              @click="clearPerson"
              class="text-muted-foreground hover:text-foreground transition-colors"
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
        <div
          v-if="
            dropdownOpen &&
            !selectedPerson &&
            (searchResults?.length || isSearching)
          "
          class="bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 absolute z-50 mt-2 w-full rounded-md border shadow-lg"
        >
          <div class="no-scrollbar max-h-64 overflow-y-auto p-1">
            <div
              v-if="isSearching && showResults"
              class="flex justify-center py-6"
            >
              <LoaderCircle
                class="text-muted-foreground h-5 w-5 animate-spin"
              />
            </div>
            <template v-else-if="showResults && searchResults?.length">
              <button
                v-for="person in searchResults"
                :key="person.person_id"
                @click="selectPerson(person)"
                class="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors"
              >
                <FlagIcon
                  v-if="person.country_iso2"
                  :code="person.country_iso2"
                />
                <span class="truncate">{{ person.name }}</span>
                <span class="text-muted-foreground ms-auto text-xs">{{
                  person.person_id
                }}</span>
              </button>
            </template>
            <div
              v-else-if="showResults"
              class="text-muted-foreground py-6 text-center text-sm"
            >
              No results found.
            </div>
          </div>
        </div>
      </div>
      <div class="flex flex-col items-center gap-3">
        <DatePicker
          v-model="rankDate"
          :disabled="!selectedPerson"
          :allow-future="false"
        />
        <div class="flex h-9 gap-2">
          <Button
            v-if="!isToday(rankDate)"
            @click="setToday"
            variant="outline"
            size="sm"
            :disabled="isRankPending"
          >
            Today
          </Button>
          <Button
            v-if="isDirty"
            @click="applyDate"
            size="sm"
            :disabled="isRankPending"
          >
            Update
          </Button>
        </div>
      </div>
    </div>
    <ErrorDisplay
      v-if="isError"
      :error="error!.toString()"
      class="mb-4 w-full"
    />
    <section v-if="selectedPerson" class="w-full">
      <div v-if="isRankPending" class="space-y-4 rounded-md border p-4">
        <Skeleton v-for="i in 8" :key="i" class="h-9 w-full" />
      </div>
      <div v-else-if="rankData?.length" class="rounded-md border shadow-sm">
        <header
          class="text-muted-foreground flex items-center justify-between px-4 py-2 text-xs font-semibold tracking-wider uppercase"
        >
          <span class="w-16 md:w-28">Rank</span>
          <span class="flex-1">Event</span>
          <span class="w-24 text-right">Score</span>
          <span class="w-8"></span>
        </header>
        <ol class="border-t">
          <li
            v-for="(eventRank, index) in rankData"
            :key="eventRank.event_id"
            class="p-1"
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
      <div v-else class="text-muted-foreground mt-12 text-center">
        <p class="text-lg">{{ selectedPerson.name }}</p>
        <p class="text-sm">No competition data found for this timeframe.</p>
      </div>
    </section>
  </div>
</template>
