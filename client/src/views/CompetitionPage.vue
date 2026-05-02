<script setup lang="ts">
import ControlPanel from "@/components/custom/ControlPanel.vue";
import FlagIcon from "@/components/custom/FlagIcon.vue";
import CompetitorLink from "@/components/custom/CompetitorLink.vue";
import WCALogo from "@/components/custom/WCALogo.vue";
import LoadingMessage from "@/components/custom/LoadingMessage.vue";
import { Checkbox } from "@/components/ui/checkbox";
import { useCompSettingsStore } from "@/lib/stores/compSettings";

import { BREAKPOINT, buildSimulationQuery, fetchWCIF } from "@/lib/utils";
import { useQuery } from "@tanstack/vue-query";
import { useWindowSize } from "@vueuse/core";
import { storeToRefs } from "pinia";
import { computed, watch, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useCompetitionData } from "@/lib/composables/useCompetitionData";

const route = useRoute();
const router = useRouter();

const store = useCompSettingsStore();
const {
  compId,
  competitorsByEvent,
  selectedEventId,
  includeDnf,
  decayHalfLife,
  startDate,
  endDate,
} = storeToRefs(store);

const { width } = useWindowSize();

const { isPending, isError, data, error } = useQuery({
  queryKey: ["competition", route.params.id],
  queryFn: () => fetchWCIF(route.params.id as string),
  staleTime: Infinity,
});

watch(
  () => route.params.id,
  (newId) => {
    if (newId && newId !== compId.value) {
      store.reset();
      compId.value = newId as string;
    }
  },
  { immediate: true },
);

const eventIds = computed(
  () => data.value?.events.map((event) => event.id) ?? [],
);

const { getCompetitorData } = useCompetitionData();

watchEffect(() => {
  // Only populate competitor data if we have data from the API
  // and the store hasn't been populated for this competition yet.
  if (data.value && Object.keys(competitorsByEvent.value).length === 0) {
    competitorsByEvent.value = getCompetitorData(
      data.value,
      isError.value,
      selectedEventId,
    );
  }
});

const currentSelectedCompetitors = computed(
  () =>
    competitorsByEvent.value[selectedEventId.value]?.filter(
      (competitor) => competitor.selected,
    ) ?? [],
);

const runSimulation = () => {
  if (!data.value) return;

  const selectedIds = currentSelectedCompetitors.value.map((item) => item.id);

  const query = buildSimulationQuery({
    name: data.value.name,
    eventId: selectedEventId.value,
    startDate: startDate.value,
    endDate: endDate.value,
    includeDnf: includeDnf.value,
    decayRate: decayHalfLife.value,
    competitors: selectedIds,
    competitionId: data.value.id,
    date: data.value.schedule.startDate,
  });

  router.push({
    path: `./${data.value.id}/results`,
    query: query as Record<string, string>,
  });
};
</script>

<template>
  <div class="flex flex-col items-center justify-center">
    <div v-if="isPending">
      <LoadingMessage message="Loading WCA Data" class="m-4 text-2xl" />
    </div>

    <div v-else-if="isError || !data?.name" class="text-red-500">
      Error fetching data: {{ error?.message || "Unknown error occurred" }}
    </div>

    <template v-else>
      <h1 class="m-4 text-center text-2xl font-bold leading-snug">
        {{ data.name }}
        <a :href="`https://www.worldcubeassociation.org/competitions/${data.id}`" target="_blank"
          class="ms-1 inline-flex [vertical-align:-0.125em]">
          <WCALogo class="h-6 w-6" />
        </a>
      </h1>

      <div>
        <ControlPanel :event-ids="eventIds" v-model:selected-event-id="selectedEventId" v-model:include-dnf="includeDnf"
          v-model:decay-rate="decayHalfLife" v-model:start-date="startDate" v-model:end-date="endDate"
          :disable-run="currentSelectedCompetitors.length < 2" @run-simulation="runSimulation" />

        <div v-if="!competitorsByEvent[selectedEventId]?.length" class="m-6 text-center text-lg">
          No one is registered for this event
        </div>

        <ol v-else class="flex-1 overflow-y-auto rounded-md border" :class="{
          'max-h-[72vh]': width > BREAKPOINT,
          'max-h-[64vh]': width <= BREAKPOINT,
        }">
          <li v-for="person in competitorsByEvent[selectedEventId]" :key="person.id"
            class="hover:bg-secondary flex items-center justify-between rounded-md p-2">
            <label class="flex w-full cursor-pointer items-center justify-between" :for="`select-${person.id}`">
              <span :class="{ 'text-muted-foreground': !person.selected }" class="flex items-center">
                <FlagIcon :code="person.country" :muted="!person.selected" />
                <CompetitorLink :name="person.name" :id="person.id" :event="selectedEventId" :iso2="null"
                  class="mx-2 flex items-center" />
              </span>

              <Checkbox v-model:checked="person.selected" class="me-2" :id="`select-${person.id}`"
                :aria-label="`Select competitor ${person.name}`" />
            </label>
          </li>
        </ol>
      </div>
    </template>
  </div>
</template>
