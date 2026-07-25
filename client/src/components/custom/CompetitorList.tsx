import type { CompetitorSimulationResult, SupportedWCAEvent } from "../../lib/types";
import { createSignal, createMemo, For, Show } from "solid-js";
import { CompetitorDropdown } from "./CompetitorDropdown";
import { RotatableChevron } from "./RotatableChevron";

type sortCol = "name" | "win" | "pod" | "rank";

interface CompetitorItem {
  id: string;
  results: () => CompetitorSimulationResult;
  setResults: (r: CompetitorSimulationResult) => void;
  color: () => string;
  setColor: (c: string) => void;
  idx: () => number;
  setIdx: (i: number) => void;
}

interface CompetitorListProps {
  simulationResults: CompetitorSimulationResult[];
  colors: string[];
  event: SupportedWCAEvent;
  value: number[][];
  onChange: (val: number[][]) => void;
}

export function CompetitorList(props: CompetitorListProps) {
  const [sortBy, setSortBy] = createSignal<sortCol>("win");
  const [sortAsc, setSortAsc] = createSignal<boolean>(false);
  const [expandedIds, setExpandedIds] = createSignal<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    const next = new Set(expandedIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedIds(next);
  };

  const headerOptions = [
    {
      flex: "flex-[2] lg:flex-[1.5]",
      id: "name" as sortCol,
      justify: "justify-start",
      label: "Name",
      padding: "ps-8",
    },
    {
      flex: "flex-1",
      id: "win" as sortCol,
      justify: "justify-center",
      label: "Chance of winning",
      padding: "",
    },
    {
      flex: "flex-1",
      id: "pod" as sortCol,
      justify: "justify-center",
      label: "Chance of podiuming",
      padding: "",
    },
    {
      flex: "flex-1",
      id: "rank" as sortCol,
      justify: "justify-center",
      label: "Expected rank",
      padding: "",
    },
  ] as const;

  const handleSort = (col: sortCol) => {
    if (sortBy() === col) {
      setSortAsc(!sortAsc());
    } else {
      setSortBy(col);
      setSortAsc(false);
    }
  };

  const itemCache = new Map<string, CompetitorItem>();

  const getSortValue = (res: CompetitorSimulationResult): number | string => {
    switch (sortBy()) {
      case "name":
        return res.name;
      case "win":
        return res.win_chance;
      case "pod":
        return res.pod_chance;
      case "rank":
        return res.expected_rank;
      default:
        return 0;
    }
  };

  const getCompetitorItems = () => {
    const currentResults = props.simulationResults;
    const currentColors = props.colors;
    const currentIds = new Set<string>();

    currentResults.forEach((results, idx) => {
      const { id } = results;
      currentIds.add(id);
      const color = currentColors[idx] ?? "";
      const existing = itemCache.get(id);
      if (existing) {
        existing.setResults(results);
        existing.setColor(color);
        existing.setIdx(idx);
      } else {
        const [resSignal, setResults] = createSignal(results);
        const [colorSignal, setColor] = createSignal(color);
        const [idxSignal, setIdx] = createSignal(idx);
        itemCache.set(id, {
          id,
          results: resSignal,
          setResults,
          color: colorSignal,
          setColor,
          idx: idxSignal,
          setIdx,
        });
      }
    });

    for (const id of itemCache.keys()) {
      if (!currentIds.has(id)) {
        itemCache.delete(id);
      }
    }

    return currentResults
      .map((r) => itemCache.get(r.id))
      .filter((item): item is CompetitorItem => item !== undefined);
  };

  const sortedItems = createMemo(() => {
    const items = getCompetitorItems();

    const sortFn = (a: CompetitorItem, b: CompetitorItem) => {
      const aVal = getSortValue(a.results());
      const bVal = getSortValue(b.results());

      const comparison =
        typeof aVal === "string" && typeof bVal === "string"
          ? aVal.localeCompare(bVal)
          : (aVal as number) - (bVal as number);

      const defaultAsc = sortBy() === "name" || sortBy() === "rank";
      const effectiveAsc = defaultAsc ? !sortAsc() : sortAsc();
      return effectiveAsc ? comparison : -comparison;
    };

    return items.toSorted(sortFn);
  });

  return (
    <div class="mt-2 rounded-md border text-card-foreground">
      <div class="me-8 flex justify-between p-1">
        <For each={headerOptions}>
          {(option) => (
            <button
              onClick={() => {
                handleSort(option.id);
              }}
              class={`flex cursor-pointer items-center ${option.padding} ${option.flex} ${option.justify}`}
            >
              <span>{option.label}</span>
              <Show when={sortBy() === option.id}>
                <span class="ms-1">
                  <RotatableChevron up={!sortAsc()} animate={false} />
                </span>
              </Show>
            </button>
          )}
        </For>
      </div>
      <hr class="mx-2 border-border" />
      <ol class="space-y-0.5 p-1">
        <For each={sortedItems()}>
          {(person) => (
            <li>
              <CompetitorDropdown
                value={props.value[person.idx()] || []}
                onChange={(updatedRow) => {
                  const updated = [...props.value];
                  updated[person.idx()] = updatedRow;
                  props.onChange(updated);
                }}
                result={person.results()}
                event={props.event}
                color={person.color()}
                isOpen={expandedIds().has(person.id)}
                onToggle={() => {
                  toggleExpanded(person.id);
                }}
              />
            </li>
          )}
        </For>
      </ol>
    </div>
  );
}
