import type { RankingHistoryPoint } from "./types";
import { createSignal, createEffect, untrack } from "solid-js";
import { createQuery } from "@tanstack/solid-query";
import { subYears, format } from "date-fns";
import { API_URL } from "./utils";

export function useRankDetail(params: {
  competitorId: () => string;
  competitorName: () => string;
  eventId: () => string;
  isOpen: () => boolean;
  rankDate: () => Date;
}) {
  const [startDate, setStartDate] = createSignal<Date | undefined>(
    subYears(untrack(params.rankDate), 1),
  );
  const [endDate, setEndDate] = createSignal<Date | undefined>(untrack(params.rankDate));

  const [appliedStartDate, setAppliedStartDate] = createSignal<Date>(
    subYears(untrack(params.rankDate), 1),
  );
  const [appliedEndDate, setAppliedEndDate] = createSignal<Date>(untrack(params.rankDate));

  createEffect(() => {
    const d = params.rankDate();
    setStartDate(subYears(d, 1));
    setEndDate(d);
    setAppliedStartDate(subYears(d, 1));
    setAppliedEndDate(d);
  });

  const applyDateRange = () => {
    const start = startDate();
    const end = endDate();
    if (start && end) {
      setAppliedStartDate(start);
      setAppliedEndDate(end);
    }
  };

  const hasCompleteRange = () => Boolean(startDate()) && Boolean(endDate());

  const [metric, setMetric] = createSignal<"value" | "rank">("rank");

  const query = createQuery(() => ({
    enabled: params.isOpen(),
    queryFn: async () => {
      const end = format(appliedEndDate(), "yyyy-MM-dd");
      const start = format(appliedStartDate(), "yyyy-MM-dd");
      const competitor_id = params.competitorId();
      const event_id = params.eventId();
      const res = await fetch(`${API_URL}/api/rankings/competitor`, {
        body: JSON.stringify({
          competitor_id,
          end_date: end,
          event_id,
          start_date: start,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to fetch details");
      }
      return res.json();
    },
    queryKey: [
      "rank-detail",
      params.competitorId(),
      params.eventId(),
      appliedStartDate().getTime(),
      appliedEndDate().getTime(),
    ],
    retry: false,
    staleTime: 1000 * 60 * 5,
  }));

  const mappedHistory = () => {
    const d = query.data;
    if (!d || !Array.isArray(d)) {
      return [];
    }

    return d.map((entry: { snapshot_date: string; rank: number; value: number }) => ({
      competitors: [
        {
          color: "#3b82f6",
          id: params.competitorId(),
          name: params.competitorName(),
          rank: entry.rank,
          value: entry.value,
        },
      ],
      date: entry.snapshot_date,
    })) as RankingHistoryPoint[];
  };

  return {
    applyDateRange,
    endDate,
    hasCompleteRange,
    mappedHistory,
    metric,
    query,
    setEndDate,
    setMetric,
    setStartDate,
    startDate,
  };
}
