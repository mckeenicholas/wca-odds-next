import { createSignal, createEffect, Show } from "solid-js";
import { createQuery, keepPreviousData } from "@tanstack/solid-query";
import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/solid-router";
import { ErrorPanel } from "../components/custom/ErrorPanel";
import { PersonalRankingsSearch } from "../components/custom/PersonalRankingsSearch";
import { PersonalRankingsProvider } from "../lib/PersonalRankingsContext";
import {
  eventOrder,
  type PersonRankInfo,
  type PersonSearchResult,
  type SupportedWCAEvent,
} from "../lib/types";
import { API_URL, isToday, toNaiveDate } from "../lib/utils";

interface PersonalSearch {
  date?: string;
}

export const Route = createFileRoute("/rankings/personal")({
  component: PersonalRankingsLayout,
  validateSearch: (search: Record<string, unknown>): PersonalSearch => {
    const result: PersonalSearch = {};
    if (typeof search.date === "string") {
      result.date = search.date;
    }
    return result;
  },
});

const getEventOrder = (event: string) => {
  switch (event) {
    case "all": {
      return -3;
    }
    case "kinch": {
      return -2;
    }
    case "kinch_strict": {
      return -1;
    }
    default: {
      return eventOrder[event as SupportedWCAEvent] ?? 999;
    }
  }
};

function PersonalRankingsLayout() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const location = useLocation();

  // Derive person ID from the current URL path when the $id child route is active
  const personId = () => {
    const path = location().pathname;
    const prefix = "/rankings/personal/";
    if (path.startsWith(prefix)) {
      const [segment] = path.slice(prefix.length).split("/");
      return segment ? decodeURIComponent(segment) : undefined;
    }
    // eslint-disable-next-line unicorn/no-useless-undefined
    return undefined;
  };

  const [selectedPerson, setSelectedPerson] = createSignal<PersonSearchResult | undefined>();

  const initialDate = () => {
    const dStr = search().date;
    if (dStr) {
      const [year, month, day] = dStr.split("-");
      if (year && month && day) {
        const d = new Date(Number(year), Number(month) - 1, Number(day));
        if (!isNaN(d.getTime())) {
          return d;
        }
      }
    }
    return new Date();
  };

  const [rankDate, setRankDate] = createSignal<Date>(initialDate());
  const [committedDate, setCommittedDate] = createSignal<Date>(initialDate());

  createEffect(() => {
    const dStr = search().date;
    if (dStr) {
      const [year, month, day] = dStr.split("-");
      if (year && month && day) {
        const d = new Date(Number(year), Number(month) - 1, Number(day));
        if (!isNaN(d.getTime())) {
          setRankDate(d);
          setCommittedDate(d);
        }
      }
    } else {
      setRankDate(new Date());
      setCommittedDate(new Date());
    }
  });

  const isDirty = () => rankDate().toDateString() !== committedDate().toDateString();

  const personQuery = createQuery(() => ({
    enabled: Boolean(personId()),
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(personId()!)}`);
      if (!res.ok) {
        throw new Error("Search failed");
      }
      const list = (await res.json()) as PersonSearchResult[];
      return list.length > 0 ? list[0] : null;
    },
    queryKey: ["person-info", personId()],
  }));

  createEffect(() => {
    const person = personQuery.data;
    if (person) {
      setSelectedPerson(person);
    } else if (person === null || !personId()) {
      setSelectedPerson(undefined);
    }
  });

  const selectPerson = (person: PersonSearchResult) => {
    setSelectedPerson(person);

    const params: Record<string, string> = {};
    if (!isToday(committedDate())) {
      params.date = toNaiveDate(committedDate());
    }

    void navigate({
      params: { id: person.person_id },
      search: params as any,
      to: "/rankings/personal/$id",
    });
  };

  const clearPerson = () => {
    setSelectedPerson(undefined);

    const params: Record<string, string> = {};
    if (!isToday(committedDate())) {
      params.date = toNaiveDate(committedDate());
    }

    void navigate({
      search: params as any,
      to: "/rankings/personal",
    });
  };

  const rankingsQuery = createQuery(() => ({
    enabled: Boolean(selectedPerson()),
    queryFn: async () => {
      const dateVal = committedDate();
      const person = selectedPerson();
      if (!person) {
        return [];
      }
      const dateParam = isToday(dateVal) ? undefined : toNaiveDate(dateVal);
      const res = await fetch(`${API_URL}/api/persons`, {
        body: JSON.stringify({
          date: dateParam,
          person_id: person.person_id,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to fetch rankings");
      }
      const res_data = (await res.json()) as PersonRankInfo[];
      res_data.sort((a, b) => getEventOrder(a.event_id) - getEventOrder(b.event_id));
      return res_data;
    },
    queryKey: ["personal-rankings", selectedPerson()?.person_id, committedDate().toDateString()],
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
  }));

  const applyDate = () => {
    setCommittedDate(new Date(rankDate()));
    const params: Record<string, string> = {};
    if (!isToday(committedDate())) {
      params.date = toNaiveDate(committedDate());
    }
    void navigate({
      params: selectedPerson() ? { id: selectedPerson()!.person_id } : undefined,
      search: params as any,
      to: selectedPerson() ? "/rankings/personal/$id" : "/rankings/personal",
    });
  };

  const setToday = () => {
    setRankDate(new Date());
    applyDate();
  };

  return (
    <div class="mx-auto flex w-full max-w-4xl flex-col items-center px-4 pb-12">
      <h1 class="my-6 text-2xl font-bold">Personal Rankings</h1>
      <PersonalRankingsSearch
        selectedPerson={selectedPerson()}
        rankDate={rankDate()}
        onRankDateChange={setRankDate}
        isDirty={isDirty()}
        onApplyDate={applyDate}
        onToday={setToday}
        onSelectPerson={selectPerson}
        onClearPerson={clearPerson}
        isPending={rankingsQuery.isPending}
      />

      <Show when={rankingsQuery.isError}>
        <div class="mt-4 w-full">
          <ErrorPanel error={rankingsQuery.error?.message ?? "Unknown error"} />
        </div>
      </Show>

      <PersonalRankingsProvider
        value={{
          selectedPerson,
          committedDate,
          isPending: () => rankingsQuery.isPending,
          isError: () => rankingsQuery.isError,
          error: () => rankingsQuery.error?.message,
          data: () => rankingsQuery.data,
        }}
      >
        <Outlet />
      </PersonalRankingsProvider>
    </div>
  );
}
