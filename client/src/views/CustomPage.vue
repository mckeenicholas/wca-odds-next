<script setup lang="ts">
import ControlPanel from "@/components/custom/ControlPanel.vue";
import FlagIcon from "@/components/custom/FlagIcon.vue";
import CompetitorLink from "@/components/custom/CompetitorLink.vue";
import { supportedWCAEvents } from "@/lib/types";
import { buildSimulationQuery, API_URL } from "@/lib/utils";
import { useQuery } from "@tanstack/vue-query";
import { LoaderCircle, Search, X } from "lucide-vue-next";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useStorage, onClickOutside, refDebounced } from "@vueuse/core";
import { useCompSettingsStore } from "@/lib/stores/compSettings";
import { storeToRefs } from "pinia";

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
const comboboxRef = ref<HTMLElement | null>(null);
const competitors = useStorage<Person[]>("competitors", []);

const debouncedInput = refDebounced(input, 250);

const { isFetching, isError, data, error } = useQuery({
  queryKey: computed(() => ["userSearch", debouncedInput.value]),
  queryFn: async () => {
    if (!debouncedInput.value.trim()) return [];
    const response = await fetch(
      `${API_URL}/api/search?q=${encodeURIComponent(debouncedInput.value)}`,
    );
    if (!response.ok) throw new Error("Search failed");

    const results = await response.json();
    return results.map(
      (r: { name: string; person_id: string; country_iso2: string }) => ({
        name: r.name,
        wca_id: r.person_id,
        country: { iso2: r.country_iso2 },
      }),
    );
  },
  enabled: computed(() => dropdownOpen.value && input.value.trim().length > 0),
});

onClickOutside(comboboxRef, () => (dropdownOpen.value = false));

const addCompetitor = (person: Person) => {
  if (!competitors.value.find((c) => c.wca_id === person.wca_id)) {
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
    name: "Custom Simulation",
    eventId: selectedEventId.value,
    startDate: startDate.value,
    endDate: endDate.value,
    includeDnf: includeDnf.value,
    decayRate: decayHalfLife.value,
    competitors: competitors.value.map((c) => c.wca_id),
  }) as Record<string, string>;

  router.push({ path: "/custom/results", query });
};
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col items-center px-4 pb-8">
    <h1 class="my-4 text-center text-xl font-semibold">Add a competitor</h1>
    <div class="relative w-full" ref="comboboxRef">
      <div
        class="border-input bg-background ring-offset-background focus-within:ring-ring flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-offset-2"
      >
        <Search class="text-muted-foreground h-4 w-4 shrink-0" />
        <input
          v-model="input"
          @keyup.enter="dropdownOpen = true"
          @input="dropdownOpen = true"
          @focus="dropdownOpen = true"
          placeholder="Search for a person..."
          class="placeholder:text-muted-foreground flex-1 bg-transparent outline-none"
          aria-label="Search for competitors"
        />
      </div>
      <div
        v-if="dropdownOpen && input && (data?.length || isFetching || isError)"
        class="bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 absolute top-full left-0 z-50 mt-2 w-full rounded-md border shadow-md"
      >
        <div class="no-scrollbar max-h-64 overflow-y-auto p-1">
          <div v-if="isFetching" class="flex items-center justify-center py-6">
            <LoaderCircle class="text-muted-foreground h-5 w-5 animate-spin" />
          </div>

          <div
            v-else-if="isError"
            class="text-muted-foreground py-4 text-center text-sm"
          >
            Error: {{ error?.message || "Unknown error occurred" }}
          </div>

          <div
            v-else-if="!data?.length"
            class="text-muted-foreground py-4 text-center text-sm"
          >
            No results found.
          </div>

          <template v-else>
            <button
              v-for="person in data"
              :key="person.wca_id"
              @click="addCompetitor(person)"
              class="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors"
            >
              <FlagIcon :code="person.country.iso2" />
              <span class="truncate">{{ person.name }}</span>
              <span class="text-muted-foreground ms-auto text-xs">{{
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
          class="hover:bg-muted/50 flex items-center justify-between rounded-md transition-colors"
        >
          <CompetitorLink
            :name="competitor.name"
            :id="competitor.wca_id"
            :iso2="competitor.country.iso2"
            class="flex items-center p-2"
          />
          <button
            class="text-muted-foreground hover:text-destructive hover:bg-secondary me-1 rounded-md p-1 transition-colors"
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
