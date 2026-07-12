import type { PersonSearchResult } from "../../lib/types";
import { createSignal, createEffect, createMemo, onCleanup, Show } from "solid-js";
import { Search } from "@kobalte/core/search";
import { createQuery } from "@tanstack/solid-query";
import { Search as SearchIcon, LoaderCircle, X } from "lucide-solid";
import { API_URL, isToday } from "../../lib/utils";
import { Button } from "../ui/button";
import { DatePicker } from "./DatePicker";
import { FlagIcon } from "./FlagIcon";
import { WCALogo } from "./WCALogo";

interface PersonalRankingsSearchProps {
  selectedPerson: PersonSearchResult | undefined;
  rankDate: Date;
  onRankDateChange: (date: Date) => void;
  isDirty: boolean;
  onApplyDate: () => void;
  onToday: () => void;
  onSelectPerson: (person: PersonSearchResult) => void;
  onClearPerson: () => void;
  isPending: boolean;
}

export function PersonalRankingsSearch(props: PersonalRankingsSearchProps) {
  const [searchTerm, setSearchTerm] = createSignal("");
  const [isOpen, setIsOpen] = createSignal(false);
  const [debouncedTerm, setDebouncedTerm] = createSignal("");

  createEffect(() => {
    const text = searchTerm();
    const timer = setTimeout(() => {
      setDebouncedTerm(text);
    }, 300);
    onCleanup(() => {
      clearTimeout(timer);
    });
  });

  const searchQuery = createQuery(() => ({
    enabled: isOpen() && debouncedTerm().trim().length >= 2,
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(debouncedTerm())}`);
      if (!res.ok) {
        throw new Error("Search failed");
      }
      return res.json() as Promise<PersonSearchResult[]>;
    },
    queryKey: ["person-search", debouncedTerm()],
    staleTime: 1000 * 60 * 2,
  }));

  const searchResults = createMemo<PersonSearchResult[]>(() => {
    const { data } = searchQuery;
    if (data) {
      return data;
    }
    return [];
  });

  const dropdownOpen = () => isOpen() && searchTerm().trim().length >= 2;

  const isSearching = () =>
    searchQuery.isFetching || (searchTerm().trim().length >= 2 && searchTerm() !== debouncedTerm());

  return (
    <div class="mb-2 flex w-full flex-col items-center gap-2">
      <div class="relative w-full max-w-md">
        <Search
          open={dropdownOpen()}
          onOpenChange={setIsOpen}
          options={searchResults()}
          optionValue="person_id"
          optionTextValue="name"
          sameWidth
          class="w-full"
          onInputChange={(val) => {
            setSearchTerm(val);
            setIsOpen(true);
          }}
          onChange={(person) => {
            if (person) {
              props.onSelectPerson(person);
            }
          }}
          itemComponent={(itemProps) => (
            <Search.Item
              item={itemProps.item}
              class="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors outline-none hover:bg-accent hover:text-accent-foreground data-[highlighted]:bg-muted data-[highlighted]:text-accent-foreground"
            >
              <Show when={itemProps.item.rawValue.country_iso2}>
                <FlagIcon code={itemProps.item.rawValue.country_iso2 ?? ""} showTooltip={false} />
              </Show>
              <Search.ItemLabel class="truncate">{itemProps.item.rawValue.name}</Search.ItemLabel>
              <span class="ms-auto text-xs text-muted-foreground">
                {itemProps.item.rawValue.person_id}
              </span>
            </Search.Item>
          )}
        >
          <Search.Control class="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring">
            <SearchIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
            <Show
              when={props.selectedPerson}
              fallback={
                <Search.Input
                  id="person-filter-input"
                  class="flex-1 border-none bg-transparent p-0 outline-none placeholder:text-muted-foreground focus:ring-0 focus:outline-none"
                  placeholder="Search for a person..."
                  value={searchTerm()}
                />
              }
            >
              {(person) => (
                <>
                  <div class="flex flex-1 items-center gap-2 truncate">
                    <Show when={person().country_iso2}>
                      <FlagIcon code={person().country_iso2!} />
                    </Show>
                    <span class="truncate font-medium">{person().name}</span>
                    <span class="text-xs text-muted-foreground">({person().person_id})</span>
                  </div>
                  <button
                    onClick={props.onClearPerson}
                    class="text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Clear selection"
                  >
                    <X class="h-4 w-4" />
                  </button>
                </>
              )}
            </Show>
          </Search.Control>

          <Search.Portal>
            <Search.Content
              class="no-scrollbar absolute z-50 mt-2 w-full rounded-md border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95"
              style={{
                display: searchTerm().trim().length < 2 ? "none" : undefined,
                width: "var(--kb-popper-anchor-width)",
              }}
            >
              <Search.Listbox class="outline-none" />
              <Show when={isSearching() && searchResults().length === 0}>
                <div class="flex items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
                  <LoaderCircle class="h-5 w-5 animate-spin text-muted-foreground" />
                  Searching...
                </div>
              </Show>
              <Show
                when={
                  !isSearching() &&
                  !searchQuery.isError &&
                  searchResults().length === 0 &&
                  searchTerm().trim().length >= 2
                }
              >
                <div class="py-6 text-center text-sm text-muted-foreground">No results found.</div>
              </Show>
              <Show when={searchQuery.isError}>
                <div class="py-6 text-center text-sm text-muted-foreground">
                  Error searching: {searchQuery.error?.message ?? "Unknown error"}
                </div>
              </Show>
            </Search.Content>
          </Search.Portal>
        </Search>
      </div>

      <div class="mt-2 flex flex-col items-center gap-2">
        <DatePicker
          value={props.rankDate}
          onChange={props.onRankDateChange}
          disabled={!props.selectedPerson}
          allowFuture={false}
        />
        <div class="flex h-9 items-center gap-2">
          <Show when={!isToday(props.rankDate)}>
            <Button
              onClick={props.onToday}
              variant="outline"
              disabled={props.isPending}
              class="h-9"
            >
              Today
            </Button>
          </Show>
          <Show when={props.isDirty}>
            <Button onClick={props.onApplyDate} disabled={props.isPending} class="h-9">
              Update
            </Button>
          </Show>
        </div>
      </div>

      <Show when={props.selectedPerson}>
        {(person) => (
          <a
            href={`https://www.worldcubeassociation.org/persons/${person().person_id}`}
            target="_blank"
            rel="noopener noreferrer"
            class="mt-2"
          >
            <Button variant="outline" class="h-9 font-normal">
              <WCALogo class="me-2 h-4 w-4" />
              View WCA Profile
            </Button>
          </a>
        )}
      </Show>
    </div>
  );
}
