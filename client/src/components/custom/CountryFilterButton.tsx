import type { CountryResult } from "../../lib/types";
import { createSignal, createEffect, onCleanup, For, Show } from "solid-js";
import { createQuery } from "@tanstack/solid-query";
import { Check, ChevronDown, Globe, Search, X } from "lucide-solid";
import { buildUrl, cn } from "../../lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { FlagIcon } from "./FlagIcon";

interface CountryFilterButtonProps {
  value: CountryResult | undefined;
  onChange: (value?: CountryResult) => void;
  includeRegions?: boolean;
}

export function CountryFilterButton(props: CountryFilterButtonProps) {
  const [open, setOpen] = createSignal(false);
  const [search, setSearch] = createSignal("");
  // eslint-disable-next-line no-unassigned-vars
  let inputRef: HTMLInputElement | undefined;

  const query = createQuery(() => ({
    queryFn: async () => {
      const res = await fetch(
        buildUrl("/api/countries", { include_regions: props.includeRegions ?? false }),
      );
      return res.json() as Promise<CountryResult[]>;
    },
    queryKey: ["countries", { include_regions: props.includeRegions ?? false }],
    staleTime: Infinity,
  }));

  createEffect(() => {
    if (open()) {
      setSearch("");
      const timer = setTimeout(() => {
        inputRef?.focus();
      }, 0);
      onCleanup(() => {
        clearTimeout(timer);
      });
    }
  });

  const specialEntries = () =>
    query.data?.filter((c) => c.id === "World" || c.id.startsWith("_")) ?? [];

  const realCountries = () =>
    query.data?.filter((c) => c.id !== "World" && !c.id.startsWith("_")) ?? [];

  const filteredSpecial = () => {
    const q = search().toLowerCase();
    if (!q) {
      return specialEntries();
    }
    return specialEntries().filter((c) => c.name.toLowerCase().includes(q));
  };

  const filteredCountries = () => {
    const q = search().toLowerCase();
    if (!q) {
      return realCountries();
    }
    return realCountries().filter((c) => c.name.toLowerCase().includes(q));
  };

  const select = (country: CountryResult) => {
    if (country.id === "World") {
      props.onChange();
    } else {
      props.onChange(country);
    }
    setOpen(false);
  };

  const clear = (e: MouseEvent) => {
    e.stopPropagation();
    props.onChange();
  };

  return (
    <Popover open={open()} onOpenChange={setOpen} gutter={4}>
      <PopoverTrigger
        class="flex h-9 w-40 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-normal shadow-sm ring-offset-background"
        id="country-filter-btn"
      >
        <span class="flex min-w-0 items-center gap-2 truncate">
          <Show
            when={props.value}
            fallback={
              <>
                <Globe class="h-4 w-4 shrink-0 opacity-50" />
                <span class="truncate">World</span>
              </>
            }
          >
            {(val) => (
              <>
                <FlagIcon code={val().iso2} showTooltip={false} />
                <span class="truncate">{val().name}</span>
              </>
            )}
          </Show>
        </span>
        <span class="flex shrink-0 items-center gap-1">
          <Show when={props.value}>
            <span onClick={clear} class="flex cursor-pointer items-center">
              <X class="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </span>
          </Show>
          <ChevronDown class="h-4 w-4 text-muted-foreground" />
        </span>
      </PopoverTrigger>

      <PopoverContent class="w-64 p-0">
        <div class="flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground">
          {/* Search Input */}
          <div class="flex items-center border-b px-3">
            <Search class="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={(el) => {
                inputRef = el;
              }}
              value={search()}
              onInput={(e) => {
                setSearch(e.currentTarget.value);
              }}
              placeholder="Search countries..."
              id="country-filter-input"
              class="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* List */}
          <div class="max-h-75 overflow-x-hidden overflow-y-auto p-1">
            <Show
              when={filteredSpecial().length > 0 || filteredCountries().length > 0}
              fallback={
                <div class="py-6 text-center text-sm text-muted-foreground">
                  No countries found.
                </div>
              }
            >
              {/* Regions Group */}
              <Show when={filteredSpecial().length > 0}>
                <div class="px-3 py-1.5 text-xs font-medium text-muted-foreground">Regions</div>
                <For each={filteredSpecial()}>
                  {(c) => {
                    const isSelected = () =>
                      (!props.value && c.id === "World") ||
                      (props.value !== undefined && props.value.id === c.id);

                    return (
                      <button
                        onClick={() => {
                          select(c);
                        }}
                        class={cn(
                          "relative flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none select-none hover:bg-accent hover:text-accent-foreground",
                          isSelected() && "bg-accent/50 text-accent-foreground",
                        )}
                      >
                        <Check
                          class={cn("h-4 w-4 shrink-0", isSelected() ? "opacity-100" : "opacity-0")}
                        />
                        <Show
                          when={c.id === "World"}
                          fallback={<FlagIcon code={c.iso2} showTooltip={false} />}
                        >
                          <Globe class="h-4 w-4 opacity-50" />
                        </Show>
                        <span>{c.name}</span>
                      </button>
                    );
                  }}
                </For>
              </Show>

              {/* Separator */}
              <Show when={filteredSpecial().length > 0 && filteredCountries().length > 0}>
                <div class="px-1 py-1">
                  <div class="h-px bg-border" />
                </div>
              </Show>

              {/* Countries Group */}
              <Show when={filteredCountries().length > 0}>
                <div class="px-3 py-1.5 text-xs font-medium text-muted-foreground">Countries</div>
                <For each={filteredCountries()}>
                  {(c) => {
                    const isSelected = () => props.value !== undefined && props.value.id === c.id;

                    return (
                      <button
                        onClick={() => {
                          select(c);
                        }}
                        class={cn(
                          "relative flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none select-none hover:bg-accent hover:text-accent-foreground",
                          isSelected() && "bg-accent/50 text-accent-foreground",
                        )}
                      >
                        <Check
                          class={cn("h-4 w-4 shrink-0", isSelected() ? "opacity-100" : "opacity-0")}
                        />
                        <FlagIcon code={c.iso2} showTooltip={false} />
                        <span>{c.name}</span>
                      </button>
                    );
                  }}
                </For>
              </Show>
            </Show>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
