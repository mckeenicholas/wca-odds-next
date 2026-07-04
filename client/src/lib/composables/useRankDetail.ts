import { useQuery } from "@tanstack/vue-query";
import { format, subYears } from "date-fns";
import { type ComputedRef, type Ref, computed, ref, watch } from "vue";
import type { RankingHistoryPoint } from "@/lib/types";
import { API_URL } from "@/lib/utils";

export function useRankDetail(params: {
  competitorId: ComputedRef<string> | Ref<string>;
  eventId: ComputedRef<string> | Ref<string>;
  competitorName: ComputedRef<string> | Ref<string>;
  rankDate: Ref<Date>;
  isOpen: Ref<boolean>;
}) {
  const selectedDateRange = ref<{ start?: Date; end?: Date }>({
    end: params.rankDate.value,
    start: subYears(params.rankDate.value, 1),
  });

  const appliedDateRange = ref({
    end: params.rankDate.value,
    start: subYears(params.rankDate.value, 1),
  });

  watch(
    params.rankDate,
    (newDate) => {
      const start = subYears(newDate, 1);
      const end = newDate;
      selectedDateRange.value = { end, start };
      appliedDateRange.value = { end, start };
    },
    { immediate: true },
  );

  const applyDateRange = () => {
    if (!selectedDateRange.value.start || !selectedDateRange.value.end) return;
    appliedDateRange.value = {
      end: selectedDateRange.value.end,
      start: selectedDateRange.value.start,
    };
  };

  const hasCompleteRange = computed(
    () => !!selectedDateRange.value.start && !!selectedDateRange.value.end,
  );

  const metric = ref<"value" | "rank">("rank");

  const {
    data: detailData,
    isPending,
    isFetching,
    error,
  } = useQuery({
    enabled: params.isOpen,
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/rankings/competitor`, {
        body: JSON.stringify({
          competitor_id: params.competitorId.value,
          end_date: format(appliedDateRange.value.end, "yyyy-MM-dd"),
          event_id: params.eventId.value,
          start_date: format(appliedDateRange.value.start, "yyyy-MM-dd"),
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
    queryKey: computed(() => [
      "rank-detail",
      params.competitorId.value,
      params.eventId.value,
      appliedDateRange.value.start.getTime(),
      appliedDateRange.value.end.getTime(),
    ]),
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const mappedHistory = computed<RankingHistoryPoint[]>(() => {
    if (!detailData.value || !Array.isArray(detailData.value)) return [];

    return detailData.value.map(
      (d: { snapshot_date: string; rank: number; value: number }) => ({
        competitors: [
          {
            color: "#3b82f6",
            id: params.competitorId.value,
            name: params.competitorName.value,
            rank: d.rank,
            value: d.value,
          },
        ],
        date: d.snapshot_date,
      }),
    );
  });

  return {
    appliedDateRange,
    applyDateRange,
    detailData,
    error,
    hasCompleteRange,
    isFetching,
    isPending,
    mappedHistory,
    metric,
    selectedDateRange,
  };
}
