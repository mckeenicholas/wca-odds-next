import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import { Search } from "@kobalte/core/search";
import { createQuery } from "@tanstack/solid-query";
import { createFileRoute, useNavigate, Link } from "@tanstack/solid-router";
import { Search as SearchIcon, LoaderCircle } from "lucide-solid";
import { buttonVariants } from "../components/ui/button";
import { formatDate } from "../lib/dateUtils";
import { fetchWCAInfo } from "../lib/utils";

interface Competition {
  start_date: string;
  id: string;
  name: string;
}

interface HomeSearch {
  q?: string;
}

export const Route = createFileRoute("/")({
  component: Home,
  validateSearch: (search: Record<string, unknown>): HomeSearch => {
    const result: HomeSearch = {};
    if (typeof search.q === "string") {
      result.q = search.q;
    }
    return result;
  },
});

function Home() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const queryText = () => search().q ?? "";
  const [rawInput, setRawInput] = createSignal(queryText());

  // Debounce typed input to update the URL query parameter (which triggers the query)
  createEffect(() => {
    const inputVal = rawInput();
    const timer = setTimeout(() => {
      if (inputVal !== queryText()) {
        void navigate({
          replace: true,
          search: (old) => ({ ...old, q: inputVal || undefined }),
        });
      }
    }, 250);

    onCleanup(() => {
      clearTimeout(timer);
    });
  });

  // Automatically keep rawInput in sync if the URL changes (e.g. Back/Forward browser navigation)
  createEffect(() => {
    setRawInput(queryText());
  });

  const query = createQuery(() => ({
    enabled: queryText().trim().length > 0,
    queryFn: async () => {
      const text = queryText().trim();
      if (!text) {
        return [] as Competition[];
      }
      return fetchWCAInfo<Competition[]>(
        `https://api.worldcubeassociation.org/competitions?q=${encodeURIComponent(text)}`,
      );
    },
    queryKey: ["competitionSearch", queryText()],
  }));

  const [results, setResults] = createSignal<Competition[]>([]);
  const [isOpen, setIsOpen] = createSignal(false);
  const dropdownOpen = () => isOpen() && rawInput().trim().length > 0;

  createEffect(() => {
    const { data } = query;
    if (data) {
      setResults(data);
    } else if (!queryText().trim()) {
      setResults([]);
    }
  });

  const isSearchingOrDebouncing = () =>
    query.isFetching || (rawInput().trim().length > 0 && rawInput() !== queryText());

  return (
    <div class="flex flex-col items-center justify-center p-4">
      <div class="mt-[12vh] flex w-full max-w-[70vw] flex-col items-center justify-center">
        <h1 class="m-6 text-center text-3xl font-bold">WCA Competition Predictor</h1>
        <h1 class="m-4 text-center text-xl">View stats for competition</h1>

        <div class="relative flex w-full flex-row">
          <Search
            open={dropdownOpen()}
            onOpenChange={setIsOpen}
            options={results()}
            optionValue="id"
            optionTextValue="name"
            sameWidth
            class="w-full"
            onInputChange={(val) => {
              setRawInput(val);
            }}
            onChange={(item) => {
              if (item) {
                void navigate({ to: `/competition/${item.id}` });
              }
            }}
            itemComponent={(props) => (
              <Search.Item
                item={props.item}
                class="flex w-full cursor-pointer flex-col rounded-md px-3 py-2 text-left text-sm transition-colors outline-none hover:bg-accent hover:text-accent-foreground data-[highlighted]:bg-muted data-[highlighted]:text-accent-foreground"
              >
                <Search.ItemLabel>{props.item.rawValue.name}</Search.ItemLabel>
                <span class="text-xs text-muted-foreground">
                  {formatDate(props.item.rawValue.start_date)}
                </span>
              </Search.Item>
            )}
          >
            <Search.Control class="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
              <SearchIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
              <Search.Input
                id="input-field"
                class="flex-1 border-none bg-transparent p-0 outline-none placeholder:text-muted-foreground focus:ring-0 focus:outline-none"
                placeholder="Search for a competition..."
                aria-label="Competition search"
                autofocus
                value={rawInput()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const text = rawInput().trim();
                    void navigate({
                      replace: true,
                      search: (old) => ({ ...old, q: text || undefined }),
                    });
                  }
                }}
              />
              <Show when={query.isFetching}>
                <LoaderCircle class="h-4 w-4 animate-spin text-muted-foreground" />
              </Show>
            </Search.Control>

            <Search.Portal>
              <Search.Content
                class="no-scrollbar absolute z-50 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                style={{
                  display: rawInput().trim().length === 0 ? "none" : undefined,
                  width: "var(--kb-popper-anchor-width)",
                }}
              >
                <Search.Listbox class="outline-none" />
                <Show when={isSearchingOrDebouncing() && results().length === 0}>
                  <div class="flex items-center justify-center gap-2 py-4 text-center text-sm text-muted-foreground">
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
                  <div class="py-4 text-center text-sm text-muted-foreground">
                    No competitions found.
                  </div>
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
      </div>

      <div class="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <Link to={"/custom"} class={buttonVariants({ variant: "secondary" })}>
          Select competitors manually
        </Link>
        <Link to={"/rankings"} class={buttonVariants({ variant: "secondary" })}>
          View Global Rankings
        </Link>
        <Link to={"/rankings/personal"} class={buttonVariants({ variant: "secondary" })}>
          View Personal Rankings
        </Link>
      </div>

      <div class="mt-4 flex flex-col items-center rounded-xl p-8 text-center shadow-sm">
        <h2 class="mb-4 text-xl font-bold">Please consider donating!</h2>

        <p class="mb-6 max-w-xl leading-relaxed">
          Services like this offering statistical analysis require a considerable amount of compute
          power, which has costs associated with it. If you enjoy using this tool, please consider
          donating to help maintain it!
        </p>

        <a
          href="https://ko-fi.com/I2I51SX94L"
          target="_blank"
          rel="noopener noreferrer"
          class="transition-transform hover:scale-105"
        >
          <img
            src="https://storage.ko-fi.com/cdn/kofi6.png?v=6"
            alt="Buy Me a Coffee at ko-fi.com"
            class="h-10 border-0"
          />
        </a>
      </div>
    </div>
  );
}
