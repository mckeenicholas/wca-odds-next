<script setup lang="ts">
import FlagIcon from "@/components/custom/FlagIcon.vue";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { CountryResult } from "@/lib/types";
import { API_URL } from "@/lib/utils";
import { useQuery } from "@tanstack/vue-query";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { Check, ChevronDown, Globe, Search, X } from "lucide-vue-next";
import { computed, nextTick, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: CountryResult | null;
    includeRegions?: boolean;
  }>(),
  {
    includeRegions: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: CountryResult | null];
}>();

const open = ref(false);
const search = ref("");
const listRef = ref<HTMLDivElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);

const { data: countries } = useQuery({
  queryKey: [
    "countries",
    {
      include_regions: props.includeRegions,
    },
  ],
  queryFn: async () => {
    const res = await fetch(
      `${API_URL}/api/countries?include_regions=${props.includeRegions}`,
    );
    return res.json() as Promise<CountryResult[]>;
  },
  staleTime: Infinity,
});

// Split countries into "special" (World + continents) and real countries
const specialEntries = computed(
  () =>
    countries.value?.filter((c) => c.id === "World" || c.id.startsWith("_")) ??
    [],
);
const realCountries = computed(
  () =>
    countries.value?.filter((c) => c.id !== "World" && !c.id.startsWith("_")) ??
    [],
);

// Filter based on search
const filteredSpecial = computed(() => {
  if (!search.value) return specialEntries.value;
  const q = search.value.toLowerCase();
  return specialEntries.value.filter((c) => c.name.toLowerCase().includes(q));
});
const filteredCountries = computed(() => {
  if (!search.value) return realCountries.value;
  const q = search.value.toLowerCase();
  return realCountries.value.filter((c) => c.name.toLowerCase().includes(q));
});

// Build a flat list with group headers for the virtualizer
type ListEntry =
  | { type: "header"; label: string }
  | { type: "separator" }
  | { type: "item"; country: CountryResult };

const flatList = computed<ListEntry[]>(() => {
  const entries: ListEntry[] = [];
  if (filteredSpecial.value.length) {
    entries.push({ type: "header", label: "Regions" });
    for (const c of filteredSpecial.value) {
      entries.push({ type: "item", country: c });
    }
  }
  if (filteredSpecial.value.length && filteredCountries.value.length) {
    entries.push({ type: "separator" });
  }
  if (filteredCountries.value.length) {
    entries.push({ type: "header", label: "Countries" });
    for (const c of filteredCountries.value) {
      entries.push({ type: "item", country: c });
    }
  }
  return entries;
});

function getCountry(index: number): CountryResult {
  return (flatList.value[index] as { type: "item"; country: CountryResult })
    .country;
}

const virtualizer = useVirtualizer({
  get count() {
    return flatList.value.length;
  },
  getScrollElement: () => listRef.value,
  estimateSize: (index) => {
    const entry = flatList.value[index];
    if (entry.type === "header") return 26;
    if (entry.type === "separator") return 9;
    return 36;
  },
  overscan: 5,
  measureElement: (el) => el.getBoundingClientRect().height,
});

// Auto-focus search input when popover opens
watch(open, async (isOpen) => {
  if (isOpen) {
    search.value = "";
    await nextTick();
    inputRef.value?.focus();
  }
});

// Keyboard navigation
const highlightedIndex = ref(-1);

watch(flatList, () => {
  highlightedIndex.value = -1;
});

function findNextItemIndex(from: number, direction: 1 | -1): number {
  let i = from;
  while (i >= 0 && i < flatList.value.length) {
    if (flatList.value[i].type === "item") return i;
    i += direction;
  }
  return -1;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    const next = findNextItemIndex(highlightedIndex.value + 1, 1);
    if (next !== -1) {
      highlightedIndex.value = next;
      virtualizer.value.scrollToIndex(next, { align: "auto" });
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    const prev = findNextItemIndex(highlightedIndex.value - 1, -1);
    if (prev !== -1) {
      highlightedIndex.value = prev;
      virtualizer.value.scrollToIndex(prev, { align: "auto" });
    }
  } else if (e.key === "Enter") {
    e.preventDefault();
    const entry = flatList.value[highlightedIndex.value];
    if (entry?.type === "item") {
      select(entry.country);
    }
  }
}

const select = (country: CountryResult) => {
  if (country.id === "World") {
    emit("update:modelValue", null);
  } else {
    emit("update:modelValue", country);
  }
  open.value = false;
};

const clear = (e: MouseEvent) => {
  e.stopPropagation();
  emit("update:modelValue", null);
};
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        role="combobox"
        :aria-expanded="open"
        class="w-40 justify-between gap-2 font-normal"
        id="country-filter-btn"
      >
        <span class="flex items-center gap-2 truncate">
          <template v-if="modelValue">
            <FlagIcon :code="modelValue.iso2" :showTooltip="false" />
            <span class="truncate">{{ modelValue.name }}</span>
          </template>
          <template v-else>
            <Globe class="h-4 w-4 shrink-0 opacity-50" />
            <span>World</span>
          </template>
        </span>
        <span class="flex shrink-0 items-center gap-1">
          <span v-if="modelValue" @click.stop="clear" class="flex items-center">
            <X class="text-muted-foreground h-3.5 w-3.5 hover:text-current" />
          </span>
          <ChevronDown class="text-muted-foreground h-4 w-4" />
        </span>
      </Button>
    </PopoverTrigger>

    <PopoverContent class="w-64 p-0">
      <div
        class="bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md"
      >
        <!-- Search input -->
        <div class="flex items-center border-b px-3">
          <Search class="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            ref="inputRef"
            v-model="search"
            placeholder="Search countries..."
            id="country-filter-input"
            class="placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            @keydown="onKeydown"
          />
        </div>

        <!-- Empty state -->
        <div
          v-if="flatList.length === 0"
          class="text-muted-foreground py-6 text-center text-sm"
        >
          No countries found.
        </div>

        <!-- Virtualized list -->
        <div
          v-else
          ref="listRef"
          class="max-h-75 overflow-x-hidden overflow-y-auto"
        >
          <div
            :style="{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }"
          >
            <div
              v-for="row in virtualizer.getVirtualItems()"
              :key="row.index"
              :ref="
                (el) => {
                  if (el) virtualizer.measureElement(el as Element);
                }
              "
              :data-index="row.index"
              :style="{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${row.start}px)`,
              }"
            >
              <!-- Group header -->
              <div
                v-if="flatList[row.index].type === 'header'"
                class="text-muted-foreground px-3 py-1.5 text-xs font-medium"
              >
                {{
                  (flatList[row.index] as { type: "header"; label: string })
                    .label
                }}
              </div>

              <!-- Separator -->
              <div
                v-else-if="flatList[row.index].type === 'separator'"
                class="px-1 py-1"
              >
                <div class="bg-border h-px" />
              </div>

              <!-- Country item -->
              <div
                v-else
                class="relative mx-1 flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none"
                :class="{
                  'bg-accent text-accent-foreground':
                    highlightedIndex === row.index,
                  'hover:bg-accent hover:text-accent-foreground':
                    highlightedIndex !== row.index,
                }"
                @click="select(getCountry(row.index))"
                @mouseenter="highlightedIndex = row.index"
              >
                <Check
                  class="h-4 w-4 shrink-0"
                  :class="
                    modelValue?.id === getCountry(row.index).id ||
                    (getCountry(row.index).id === 'World' && !modelValue)
                      ? 'opacity-100'
                      : 'opacity-0'
                  "
                />
                <Globe
                  v-if="getCountry(row.index).id === 'World'"
                  class="h-4 w-4 opacity-50"
                />
                <FlagIcon
                  v-else-if="!getCountry(row.index).id.startsWith('_')"
                  :code="getCountry(row.index).iso2"
                  :showTooltip="false"
                />
                <span
                  :class="{
                    'ms-6':
                      getCountry(row.index).id !== 'World' &&
                      getCountry(row.index).id.startsWith('_'),
                  }"
                >
                  {{ getCountry(row.index).name }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
