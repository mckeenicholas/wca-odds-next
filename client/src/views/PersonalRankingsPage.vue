<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { onClickOutside, useDebounceFn } from "@vueuse/core";
import { LoaderCircle, Search, X } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { SupportedWCAEvent } from "@/lib/types";
import DatePicker from "@/components/custom/DatePicker.vue";
import ErrorDisplay from "@/components/custom/ErrorPanel.vue";
import EventRankDropdown from "@/components/custom/EventRankDropdown.vue";
import FlagIcon from "@/components/custom/FlagIcon.vue";
import WCALogo from "@/components/custom/WCALogo.vue";
import Button from "@/components/ui/button/Button.vue";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type PersonRankInfo,
  type PersonSearchResult,
  eventOrder,
} from "@/lib/types";
import { API_URL, isToday, toNaiveDate } from "@/lib/utils";

const route = useRoute();
const router = useRouter();

const searchTerm = ref("");
const debouncedTerm = ref("");
const selectedPerson = ref<PersonSearchResult | undefined>(undefined);
const dropdownOpen = ref(false);
const searchInputRef = ref<HTMLInputElement | undefined>(undefined);
const comboboxRef = ref<HTMLElement | undefined>(undefined);

const rankDate = ref(new Date());
const committedDate = ref(new Date());

const isDirty = computed(
  () => rankDate.value.toDateString() !== committedDate.value.toDateString(),
);

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
          selectedPerson.value = undefined;
        }
      } catch (error) {
        console.error(error);
      }
    } else if (!newId) {
      selectedPerson.value = undefined;
    }
  },
  { immediate: true },
);

// Search people
const { data: searchResults, isFetching: isSearching } = useQuery({
  enabled: computed(() => debouncedTerm.value.trim().length >= 2),
  queryFn: async () => {
    const res = await fetch(
      `${API_URL}/api/search?q=${encodeURIComponent(debouncedTerm.value)}`,
    );
    if (!res.ok) throw new Error("Search failed");
    return res.json() as Promise<PersonSearchResult[]>;
  },
  queryKey: computed(() => ["person-search", debouncedTerm.value]),
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
  selectedPerson.value = undefined;
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
  enabled: computed(() => Boolean(selectedPerson.value)),
  queryFn: async () => {
    const res = await fetch(`${API_URL}/api/persons`, {
      body: JSON.stringify({
        date: isToday(committedDate.value)
          ? undefined
          : toNaiveDate(committedDate.value),
        person_id: selectedPerson.value!.person_id,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
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
  queryKey: computed(() => [
    "personal-rankings",
    selectedPerson.value?.person_id,
    committedDate.value.toDateString(),
  ]),
  staleTime: 1000 * 60 * 5,
});

const applyDate = () => {
  committedDate.value = new Date(rankDate.value);
  router.replace({
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
    <div class="mb-2 flex w-full flex-col items-center gap-2">
      <div ref="comboboxRef" class="relative w-full max-w-md">
        <div
          class="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring"
        >
          <Search class="h-4 w-4 shrink-0 text-muted-foreground" />
          <template v-if="selectedPerson">
            <div class="flex flex-1 items-center gap-2 truncate">
              <FlagIcon
                v-if="selectedPerson.country_iso2"
                :code="selectedPerson.country_iso2"
              />
              <span class="truncate font-medium">{{
                selectedPerson.name
              }}</span>
              <span class="text-xs text-muted-foreground"
                >({{ selectedPerson.person_id }})</span
              >
            </div>
            <button
              @click="clearPerson"
              class="text-muted-foreground transition-colors hover:text-foreground"
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
            class="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div
          v-if="
            dropdownOpen &&
            !selectedPerson &&
            (searchResults?.length || isSearching)
          "
          class="absolute z-50 mt-2 w-full rounded-md border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          <div class="no-scrollbar max-h-64 overflow-y-auto p-1">
            <div
              v-if="isSearching && showResults"
              class="flex justify-center py-6"
            >
              <LoaderCircle
                class="h-5 w-5 animate-spin text-muted-foreground"
              />
            </div>
            <template v-else-if="showResults && searchResults?.length">
              <button
                v-for="person in searchResults"
                :key="person.person_id"
                @click="selectPerson(person)"
                class="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <FlagIcon
                  v-if="person.country_iso2"
                  :code="person.country_iso2"
                />
                <span class="truncate">{{ person.name }}</span>
                <span class="ms-auto text-xs text-muted-foreground">{{
                  person.person_id
                }}</span>
              </button>
            </template>
            <div
              v-else-if="showResults"
              class="py-6 text-center text-sm text-muted-foreground"
            >
              No results found.
            </div>
          </div>
        </div>
      </div>
      <div class="flex flex-col items-center gap-2">
        <DatePicker
          v-model="rankDate"
          :disabled="!selectedPerson"
          :allow-future="false"
        />
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
      <a
        v-if="selectedPerson"
        :href="`https://www.worldcubeassociation.org/persons/${selectedPerson.person_id}`"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Button variant="outline" class="font-normal">
          <WCALogo class="h-4 w-4" />
          View WCA Profile
        </Button>
      </a>
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
          class="flex items-center justify-between px-4 py-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
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
      <div v-else class="mt-12 text-center text-muted-foreground">
        <p class="text-lg">{{ selectedPerson.name }}</p>
        <p class="text-sm">No competition data found for this timeframe.</p>
      </div>
    </section>
  </div>
</template>
