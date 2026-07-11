import { createSignal, createEffect, onCleanup, For, Show } from "solid-js";
import { createQuery } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { Search } from "@kobalte/core/search";
import { Search as SearchIcon, LoaderCircle, X } from "lucide-solid";
import { CompetitorLink } from "../components/custom/CompetitorLink";
import { ControlPanel } from "../components/custom/ControlPanel";
import { FlagIcon } from "../components/custom/FlagIcon";
import { compSettingsStore } from "../lib/stores/compSettings";
import { supportedWCAEvents } from "../lib/types";
import { API_URL, buildSimulationQuery } from "../lib/utils";

interface Person {
  name: string;
  wca_id: string;
  country: { iso2: string };
}

export const Route = createFileRoute("/custom")({
  component: CustomPage,
});

function CustomPage() {
  const navigate = useNavigate();

  const [rawInput, setRawInput] = createSignal("");
  const [isOpen, setIsOpen] = createSignal(false);
  const dropdownOpen = () => isOpen() && rawInput().trim().length > 0;

  const [debouncedInput, setDebouncedInput] = createSignal("");

  const [competitors, setCompetitors] = createSignal<Person[]>(
    (() => {
      const saved = localStorage.getItem("competitors");
      try {
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    })(),
  );

  createEffect(() => {
    localStorage.setItem("competitors", JSON.stringify(competitors()));
  });

  createEffect(() => {
    const text = rawInput();
    const timer = setTimeout(() => {
      setDebouncedInput(text);
    }, 250);
    onCleanup(() => {
      clearTimeout(timer);
    });
  });

  const query = createQuery(() => ({
    enabled: dropdownOpen() && rawInput().trim().length > 0,
    queryFn: async () => {
      const term = debouncedInput().trim();
      if (!term) {
        return [] as Person[];
      }
      const response = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(term)}`);
      if (!response.ok) {
        throw new Error("Search failed");
      }

      const results = await response.json();
      return results.map((r: { name: string; person_id: string; country_iso2: string }) => ({
        country: { iso2: r.country_iso2 },
        name: r.name,
        wca_id: r.person_id,
      })) as Person[];
    },
    queryKey: ["userSearch", debouncedInput()],
  }));

  const [results, setResults] = createSignal<Person[]>([]);
  createEffect(() => {
    const { data } = query;
    if (data) {
      setResults(data);
    } else if (!rawInput().trim()) {
      setResults([]);
    }
  });

  const isSearchingOrDebouncing = () =>
    query.isFetching || (rawInput().trim().length > 0 && rawInput() !== debouncedInput());

  const addCompetitor = (person: Person) => {
    if (!competitors().some((c) => c.wca_id === person.wca_id)) {
      setCompetitors((prev) => [...prev, person]);
      setRawInput("");
      setIsOpen(false);
    }
  };

  const removeCompetitor = (id: string) => {
    setCompetitors((prev) => prev.filter((p) => p.wca_id !== id));
  };

  const runSimulation = () => {
    const startD = compSettingsStore.startDate();
    const endD = compSettingsStore.endDate();
    if (!startD || !endD) {
      return;
    }

    const queryParams = buildSimulationQuery({
      competitors: competitors().map((c) => c.wca_id),
      decayRate: compSettingsStore.decayHalfLife(),
      endDate: endD,
      eventId: compSettingsStore.selectedEventId(),
      includeDnf: compSettingsStore.includeDnf(),
      name: "Custom Simulation",
      startDate: startD,
    });

    void navigate({
      to: "/competition/$id/results",
      params: { id: "custom" },
      search: queryParams as any,
    });
  };

  return (
    <div class="mx-auto flex w-full max-w-5xl flex-col items-center px-4 pb-8">
      <h1 class="my-4 text-center text-xl font-semibold">Add a competitor</h1>
      <div class="relative w-full">
        <Search
          open={dropdownOpen()}
          onOpenChange={setIsOpen}
          options={results()}
          optionValue="wca_id"
          optionTextValue="name"
          sameWidth
          class="w-full"
          onInputChange={(val) => {
            setRawInput(val);
            setIsOpen(true);
          }}
          onChange={(person) => {
            if (person) {
              addCompetitor(person);
            }
          }}
          itemComponent={(props) => (
            <Search.Item
              item={props.item}
              class="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground data-[highlighted]:bg-muted data-[highlighted]:text-accent-foreground outline-none"
            >
              <FlagIcon code={props.item.rawValue.country.iso2} />
              <Search.ItemLabel class="truncate">{props.item.rawValue.name}</Search.ItemLabel>
              <span class="ms-auto text-xs text-muted-foreground">
                {props.item.rawValue.wca_id}
              </span>
            </Search.Item>
          )}
        >
          <Search.Control class="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
            <SearchIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
            <Search.Input
              id="input-field"
              class="flex-1 bg-transparent outline-none placeholder:text-muted-foreground border-none p-0 focus:ring-0 focus:outline-none"
              placeholder="Search for a person..."
              aria-label="Search for competitors"
              value={rawInput()}
            />
            <Show when={query.isFetching}>
              <LoaderCircle class="h-4 w-4 animate-spin text-muted-foreground" />
            </Show>
          </Search.Control>

          <Search.Portal>
            <Search.Content
              class="absolute z-50 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md no-scrollbar animate-in fade-in-0 zoom-in-95"
              style={{
                display: rawInput().trim().length === 0 ? "none" : undefined,
                width: "var(--kb-popper-anchor-width)",
              }}
            >
              <Search.Listbox class="outline-none" />
              <Show when={isSearchingOrDebouncing() && results().length === 0}>
                <div class="py-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <LoaderCircle class="h-4 w-4 animate-spin text-muted-foreground" />
                  Searching...
                </div>
              </Show>
              <Show
                when={
                  !isSearchingOrDebouncing() &&
                  !query.isError &&
                  results().length === 0 &&
                  rawInput().trim().length > 0
                }
              >
                <div class="py-4 text-center text-sm text-muted-foreground">No results found.</div>
              </Show>
              <Show when={query.isError}>
                <div class="py-4 text-center text-sm text-muted-foreground">
                  Error fetching data: {query.error?.message ?? "Unknown error occurred"}
                </div>
              </Show>
            </Search.Content>
          </Search.Portal>
        </Search>
      </div>
      <div class="mt-2 w-full">
        <ControlPanel
          eventIds={[...supportedWCAEvents]}
          selectedEventId={compSettingsStore.selectedEventId()}
          onSelectedEventIdChange={compSettingsStore.setSelectedEventId}
          includeDnf={compSettingsStore.includeDnf()}
          onIncludeDnfChange={compSettingsStore.setIncludeDnf}
          decayRate={compSettingsStore.decayHalfLife()}
          onDecayRateChange={compSettingsStore.setDecayHalfLife}
          startDate={compSettingsStore.startDate()}
          onStartDateChange={compSettingsStore.setStartDate}
          endDate={compSettingsStore.endDate()}
          onEndDateChange={compSettingsStore.setEndDate}
          disableRun={competitors().length < 2}
          onRunSimulation={runSimulation}
        />
      </div>
      <Show when={competitors().length > 0}>
        <div class="mt-6 w-full overflow-hidden rounded-md border p-1 shadow-sm">
          <ol>
            <For each={competitors()}>
              {(competitor) => (
                <li class="flex items-center justify-between rounded-md transition-colors hover:bg-muted/50">
                  <CompetitorLink
                    name={competitor.name}
                    id={competitor.wca_id}
                    iso2={competitor.country.iso2}
                    class="flex items-center p-2"
                  />
                  <button
                    class="me-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                    aria-label="remove competitor"
                    onClick={() => {
                      removeCompetitor(competitor.wca_id);
                    }}
                  >
                    <X size={20} />
                  </button>
                </li>
              )}
            </For>
          </ol>
        </div>
      </Show>
    </div>
  );
}
