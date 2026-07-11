import { eventNames, type SimulationAPIResults, type SupportedWCAEvent } from "../../lib/types";
import { formatPercentage, toClockFormat } from "../../lib/utils";
import { PieChart } from "../charts/PieChart";

interface ResultsSummaryProps {
  data: SimulationAPIResults;
  colors: string[];
  event: SupportedWCAEvent;
}

export function ResultsSummary(props: ResultsSummaryProps) {
  const topCompetitor = () =>
    props.data.competitor_results.reduce(
      (max, competitor) => (competitor.win_chance > max.win_chance ? competitor : max),
      props.data.competitor_results[0],
    );

  const topCompetitorStats = () => {
    const comp = topCompetitor();
    return {
      avgRank: comp.expected_rank.toFixed(2),
      expectedAvg: toClockFormat(comp.mean_no_dnf),
      podiumChance: formatPercentage(comp.pod_chance, true),
      winChance: formatPercentage(comp.win_chance, true),
    };
  };

  return (
    <div class="mb-2 flex h-full flex-col gap-2 md:flex-row">
      <div class="grow rounded-md border p-4 text-card-foreground">
        <p class="mb-2 text-lg font-bold">{eventNames[props.event]} Statistics</p>

        <div class="space-y-2 text-sm text-muted-foreground">
          <p>
            <span class="font-semibold text-foreground">{topCompetitor().name}</span> has the
            highest odds of winning with:
          </p>
          <ul class="ml-4 list-inside list-disc space-y-1">
            <li>
              <span class="font-medium text-foreground">{topCompetitorStats().winChance}</span>{" "}
              chance of winning
            </li>
            <li>
              <span class="font-medium text-foreground">{topCompetitorStats().podiumChance}</span>{" "}
              chance of podium finish
            </li>
            <li>
              Average rank of{" "}
              <span class="font-medium text-foreground">{topCompetitorStats().avgRank}</span>
            </li>
            <li>
              Expected average of{" "}
              <span class="font-medium text-foreground">{topCompetitorStats().expectedAvg}</span>
            </li>
          </ul>
        </div>
      </div>
      <div class="flex shrink-0 items-center justify-center rounded-md border  p-2">
        <PieChart data={props.data} colors={props.colors} />
      </div>
    </div>
  );
}
