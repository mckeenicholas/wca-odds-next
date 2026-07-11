import { Show } from "solid-js";
import { cn } from "../../lib/utils";

interface RankChangeIndicatorProps {
  change: number | null | undefined;
}

export function RankChangeIndicator(props: RankChangeIndicatorProps) {
  return (
    <Show when={props.change !== null && props.change !== undefined}>
      <span
        class={cn(
          "ms-2 inline-flex items-center gap-px text-xs",
          (props.change ?? 0) > 0 && "text-green-500",
          (props.change ?? 0) < 0 && "text-red-500",
          props.change === 0 && "text-muted-foreground",
        )}
      >
        <Show
          when={(props.change ?? 0) > 0}
          fallback={
            <Show
              when={(props.change ?? 0) < 0}
              fallback={
                <svg class="h-2 w-2" viewBox="0 0 10 10">
                  <rect x="0" y="4" width="10" height="2" fill="currentColor" />
                </svg>
              }
            >
              <svg class="h-2 w-2" viewBox="0 0 10 10">
                <polygon points="0,0 10,0 5,10" fill="currentColor" />
              </svg>
            </Show>
          }
        >
          <svg class="h-2 w-2" viewBox="0 0 10 10">
            <polygon points="5,0 10,10 0,10" fill="currentColor" />
          </svg>
        </Show>
        <Show when={props.change !== 0}>
          <span class="ms-0.5 text-[10px]">{Math.abs(props.change ?? 0)}</span>
        </Show>
      </span>
    </Show>
  );
}
