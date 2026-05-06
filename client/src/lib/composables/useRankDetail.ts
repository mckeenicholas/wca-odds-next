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
  const selectedDateRange = ref({
    start: subYears(params.rankDate.value, 1),
    end: params.rankDate.value,
  });

  const appliedDateRange = ref({
    start: subYears(params.rankDate.value, 1),
    end: params.rankDate.value,
  });

  watch(
    params.rankDate,
    (newDate) => {
      const start = subYears(newDate, 1);
      const end = newDate;
      selectedDateRange.value = { start, end };
      appliedDateRange.value = { start, end };
    },
    { immediate: true },
  );

  const applyDateRange = () => {
    appliedDateRange.value = { ...selectedDateRange.value };
  };

  const metric = ref<"value" | "rank">("rank");

  const {
    data: detailData,
    isPending,
    isFetching,
    error,
  } = useQuery({
    queryKey: computed(() => [
      "rank-detail",
      params.competitorId.value,
      params.eventId.value,
      appliedDateRange.value.start.getTime(),
      appliedDateRange.value.end.getTime(),
    ]),
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/rankings/competitor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitor_id: params.competitorId.value,
          event_id: params.eventId.value,
          start_date: format(appliedDateRange.value.start, "yyyy-MM-dd"),
          end_date: format(appliedDateRange.value.end, "yyyy-MM-dd"),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to fetch details");
      }
      return res.json();
    },
    enabled: params.isOpen,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const mappedHistory = computed<RankingHistoryPoint[]>(() => {
    if (!detailData.value || !Array.isArray(detailData.value)) return [];

    return detailData.value.map(
      (d: { snapshot_date: string; rank: number; value: number }) => ({
        date: d.snapshot_date,
        competitors: [
          {
            id: params.competitorId.value,
            name: params.competitorName.value,
            rank: d.rank,
            value: d.value,
            color: "#3b82f6",
          },
        ],
      }),
    );
  });

  return {
    selectedDateRange,
    appliedDateRange,
    applyDateRange,
    metric,
    detailData,
    isPending,
    isFetching,
    error,
    mappedHistory,
  };
}
