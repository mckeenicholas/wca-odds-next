<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { onClickOutside, refDebounced, useStorage } from "@vueuse/core";
import { LoaderCircle, Search, X } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import CompetitorLink from "@/components/custom/CompetitorLink.vue";
import ControlPanel from "@/components/custom/ControlPanel.vue";
import FlagIcon from "@/components/custom/FlagIcon.vue";
import { useCompSettingsStore } from "@/lib/stores/compSettings";
import { supportedWCAEvents } from "@/lib/types";
import { API_URL, buildSimulationQuery } from "@/lib/utils";

interface Person {
  name: string;
  wca_id: string;
  country: { iso2: string };
}

const router = useRouter();
const store = useCompSettingsStore();
const { selectedEventId, includeDnf, decayHalfLife, startDate, endDate } =
  storeToRefs(store);

const input = ref("");
const dropdownOpen = ref(false);
const comboboxRef = ref<HTMLElement | undefined>(undefined);
const competitors = useStorage<Person[]>("competitors", []);

const debouncedInput = refDebounced(input, 250);

const { isFetching, isError, data, error } = useQuery({
  enabled: computed(() => dropdownOpen.value && input.value.trim().length > 0),
  queryFn: async () => {
    if (!debouncedInput.value.trim()) return [];
    const response = await fetch(
      `${API_URL}/api/search?q=${encodeURIComponent(debouncedInput.value)}`,
    );
    if (!response.ok) throw new Error("Search failed");

    const results = await response.json();
    return results.map(
      (r: { name: string; person_id: string; country_iso2: string }) => ({
        country: { iso2: r.country_iso2 },
        name: r.name,
        wca_id: r.person_id,
      }),
    );
  },
  queryKey: computed(() => ["userSearch", debouncedInput.value]),
});

onClickOutside(comboboxRef, () => (dropdownOpen.value = false));

const addCompetitor = (person: Person) => {
  if (!competitors.value.some((c) => c.wca_id === person.wca_id)) {
    competitors.value.push(person);
    input.value = "";
    dropdownOpen.value = false;
  }
};

const removeCompetitor = (id: string) => {
  competitors.value = competitors.value.filter((p) => p.wca_id !== id);
};

const runSimulation = () => {
  const query = buildSimulationQuery({
    competitors: competitors.value.map((c) => c.wca_id),
    decayRate: decayHalfLife.value,
    endDate: endDate.value!,
    eventId: selectedEventId.value,
    includeDnf: includeDnf.value,
    name: "Custom Simulation",
    startDate: startDate.value!,
  }) as Record<string, string>;

  router.push({ path: "/custom/results", query });
};
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col items-center px-4 pb-8">
    <h1 class="my-4 text-center text-xl font-semibold">Add a competitor</h1>
    <div class="relative w-full" ref="comboboxRef">
      <div
        class="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
      >
        <Search class="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          v-model="input"
          @keyup.enter="dropdownOpen = true"
          @input="dropdownOpen = true"
          @focus="dropdownOpen = true"
          placeholder="Search for a person..."
          class="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          aria-label="Search for competitors"
        />
      </div>
      <div
        v-if="dropdownOpen && input && (data?.length || isFetching || isError)"
        class="absolute top-full left-0 z-50 mt-2 w-full rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      >
        <div class="no-scrollbar max-h-64 overflow-y-auto p-1">
          <div v-if="isFetching" class="flex items-center justify-center py-6">
            <LoaderCircle class="h-5 w-5 animate-spin text-muted-foreground" />
          </div>

          <div
            v-else-if="isError"
            class="py-4 text-center text-sm text-muted-foreground"
          >
            Error: {{ error?.message || "Unknown error occurred" }}
          </div>

          <div
            v-else-if="!data?.length"
            class="py-4 text-center text-sm text-muted-foreground"
          >
            No results found.
          </div>

          <template v-else>
            <button
              v-for="person in data"
              :key="person.wca_id"
              @click="addCompetitor(person)"
              class="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <FlagIcon :code="person.country.iso2" />
              <span class="truncate">{{ person.name }}</span>
              <span class="ms-auto text-xs text-muted-foreground">{{
                person.wca_id
              }}</span>
            </button>
          </template>
        </div>
      </div>
    </div>
    <div class="mt-2 w-full">
      <ControlPanel
        :event-ids="[...supportedWCAEvents]"
        v-model:selected-event-id="selectedEventId"
        v-model:include-dnf="includeDnf"
        v-model:decay-rate="decayHalfLife"
        v-model:start-date="startDate"
        v-model:end-date="endDate"
        :disableRun="competitors.length < 2"
        @run-simulation="runSimulation"
      />
    </div>
    <div
      v-if="competitors.length"
      class="mt-6 w-full overflow-hidden rounded-md border p-1 shadow-sm"
    >
      <ol>
        <li
          v-for="competitor in competitors"
          :key="competitor.wca_id"
          class="flex items-center justify-between rounded-md transition-colors hover:bg-muted/50"
        >
          <CompetitorLink
            :name="competitor.name"
            :id="competitor.wca_id"
            :iso2="competitor.country.iso2"
            class="flex items-center p-2"
          />
          <button
            class="me-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
            aria-label="remove competitor"
            @click="removeCompetitor(competitor.wca_id)"
          >
            <X :size="20" />
          </button>
        </li>
      </ol>
    </div>
  </div>
</template>
