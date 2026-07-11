import type { CompetitorSimulationResult, SupportedWCAEvent } from "../../lib/types";
import { createSignal, createMemo, For, Show } from "solid-js";
import { CompetitorDropdown } from "./CompetitorDropdown";
import { RotatableChevron } from "./RotatableChevron";

type sortCol = "name" | "win" | "pod" | "rank";

interface GroupedResults {
  idx: number;
  results: CompetitorSimulationResult;
  color: string;
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

  const groupedProps = createMemo(() => {
    const getSortValue = (item: GroupedResults): number | string => {
      switch (sortBy()) {
        case "name":
          return item.results.name;
        case "win":
          return item.results.win_chance;
        case "pod":
          return item.results.pod_chance;
        case "rank":
          return item.results.expected_rank;
        default:
          return 0;
      }
    };

    const sortFn = (a: GroupedResults, b: GroupedResults) => {
      const aVal = getSortValue(a);
      const bVal = getSortValue(b);

      const comparison =
        typeof aVal === "string" && typeof bVal === "string"
          ? aVal.localeCompare(bVal)
          : (aVal as number) - (bVal as number);

      const defaultAsc = sortBy() === "name" || sortBy() === "rank";
      const effectiveAsc = defaultAsc ? !sortAsc() : sortAsc();
      return effectiveAsc ? comparison : -comparison;
    };

    return props.simulationResults
      .map((results, idx) => ({
        color: props.colors[idx],
        idx,
        results,
      }))
      .toSorted(sortFn);
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
              class={`flex cursor-pointer items-center text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground ${option.padding} ${option.flex} ${option.justify}`}
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
        <For each={groupedProps()}>
          {(person) => (
            <li>
              <CompetitorDropdown
                value={props.value[person.idx] || []}
                onChange={(updatedRow) => {
                  const updated = [...props.value];
                  updated[person.idx] = updatedRow;
                  props.onChange(updated);
                }}
                result={person.results}
                event={props.event}
                color={person.color}
              />
            </li>
          )}
        </For>
      </ol>
    </div>
  );
}
