<script setup lang="ts">
import { LoaderCircle, Search } from "lucide-vue-next";
import { onClickOutside } from "@vueuse/core";
import { fetchWCAInfo, formatDate } from "@/lib/utils";
import { useQuery } from "@tanstack/vue-query";
import { useDebounceFn } from "@vueuse/core";
import { computed, onMounted, ref, useTemplateRef, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { Button } from "@/components/ui/button";

import { useListNavigation } from "@/lib/composables/useListNavigation";

interface Competition {
  start_date: string;
  id: string;
  name: string;
}

const route = useRoute();
const router = useRouter();
const input = ref<string>((route.query.q as string) || "");
const listContainerRef = useTemplateRef<HTMLDivElement>("listContainer");

const comboboxRef = ref<HTMLElement | null>(null);
const dropdownOpen = ref(false);

onClickOutside(comboboxRef, () => {
  dropdownOpen.value = false;
});

onMounted(() => {
  refetch();
  const inputField = document.getElementById("input-field");
  inputField?.focus();
});

watch(
  input,
  useDebounceFn((newInput) => {
    const trimmedInput = newInput?.trim();
    router.push({
      query: trimmedInput ? { q: trimmedInput } : {},
    });
    if (trimmedInput) {
      refetch();
      dropdownOpen.value = true;
    } else {
      selectedResult.value = -1;
    }
  }, 250),
);

const { isFetching, isError, data, error, refetch } = useQuery({
  queryKey: computed(() => ["competitionSearch", input.value]),
  queryFn: () => {
    if (!input.value.trim()) return Promise.resolve([]);
    return fetchWCAInfo<Competition[]>(
      `https://api.worldcubeassociation.org/competitions?q=${input.value.trim()}`,
    );
  },
  enabled: false,
});

const { selectedResult, handleKeydown, resetSelection } = useListNavigation({
  data,
  listContainerRef,
  onSelectPath: (item) => `/competition/${item.id}`,
});

watch(data, () => {
  resetSelection();
});
</script>

<template>
  <div class="-mt-2 flex flex-col items-center justify-center">
    <div>
      <h1 class="m-6 text-center text-3xl font-bold">
        WCA Competition Predictor
      </h1>
      <h1 class="m-4 text-center text-xl">Find a competition</h1>
      <div ref="comboboxRef" class="relative flex min-w-[70vw] flex-row">
        <div
          class="border-input bg-background ring-offset-background flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <Search class="text-muted-foreground h-4 w-4 shrink-0" />
          <input
            id="input-field"
            v-model="input"
            @keyup.enter="refetch()"
            @keydown="handleKeydown"
            @focus="dropdownOpen = true"
            placeholder="Search for a competition..."
            class="placeholder:text-muted-foreground flex-1 bg-transparent outline-none"
            aria-label="Competition search"
            aria-describedby="search-instructions"
          />
        </div>

        <!-- Dropdown results -->
        <div
          v-if="
            dropdownOpen &&
            input &&
            ((data?.length ?? 0) > 0 || isFetching || isError)
          "
          class="bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 absolute top-full left-0 z-50 mt-1 w-full rounded-md border shadow-md"
        >
          <div
            class="no-scrollbar max-h-64 overflow-y-scroll p-1"
            ref="listContainer"
            role="listbox"
            aria-label="Competition search results"
          >
            <div
              v-if="isFetching"
              class="flex items-center justify-center py-4"
            >
              <LoaderCircle
                class="text-muted-foreground h-5 w-5 animate-spin"
              />
            </div>
            <div
              v-else-if="isError"
              class="text-muted-foreground py-4 text-center text-sm"
            >
              Error fetching data:
              {{ error?.message || "Unknown error occurred" }}
            </div>
            <div
              v-else-if="!data?.length"
              class="text-muted-foreground py-4 text-center text-sm"
            >
              No competitions found.
            </div>
            <template v-else>
              <RouterLink
                v-for="(result, index) in data"
                :key="result.id"
                :to="`/competition/${result.id}`"
                class="flex w-full cursor-pointer flex-col rounded-md px-3 py-2 text-left text-sm transition-colors"
                :class="[
                  index === selectedResult
                    ? 'bg-muted'
                    : 'hover:bg-accent hover:text-accent-foreground',
                ]"
                role="option"
                :aria-selected="index === selectedResult"
              >
                <span>{{ result.name }}</span>
                <span class="text-secondary-foreground text-xs">
                  {{ formatDate(result.start_date) }}
                </span>
              </RouterLink>
            </template>
          </div>
        </div>
      </div>
    </div>
    <div
      class="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row"
    >
      <RouterLink to="/custom">
        <Button variant="secondary">Select competitors manually</Button>
      </RouterLink>
      <RouterLink to="/rankings">
        <Button variant="secondary">View Global Rankings</Button>
      </RouterLink>
      <RouterLink to="/rankings/personal">
        <Button variant="secondary">View Personal Rankings</Button>
      </RouterLink>
    </div>
  </div>
  <div
    class="mt-4 flex flex-col items-center rounded-xl p-8 text-center shadow-sm"
  >
    <h2 class="mb-4 text-xl font-bold">Please consider donating!</h2>

    <p class="mb-6 max-w-xl leading-relaxed">
      Services like this offering statistical analysis require a considerable
      amount of compute power, which has costs associated with it. If you enjoy
      using this tool, please consider donating to help maintain it!
    </p>

    <a
      href="https://ko-fi.com/I2I51SX94L"
      target="_blank"
      class="transition-transform hover:scale-105"
    >
      <img
        src="https://storage.ko-fi.com/cdn/kofi6.png?v=6"
        alt="Buy Me a Coffee at ko-fi.com"
        class="h-10 border-0"
      />
    </a>
  </div>
</template>
