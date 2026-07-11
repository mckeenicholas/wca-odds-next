import { Component, For } from "solid-js";
import { buttonVariants } from "../ui/button";
import { cn } from "../../lib/utils";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-solid";
import { DayCell } from "./DayCell";
import { formatMonthYear, getCalendarWeeks } from "../../lib/dateUtils";

const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const navButtonClass = cn(
  buttonVariants({ variant: "outline" }),
  "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
);

interface CalendarPanelProps {
  month: Date;
  onPrevYear: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onNextYear: () => void;
  startDate: Date | undefined;
  endDate: Date | undefined;
  hoveredDate: Date | null;
  allowFuture: boolean | undefined;
  onDateSelect: (date: Date) => void;
  onDateHover: (date: Date | null) => void;
}

export const CalendarPanel: Component<CalendarPanelProps> = (props) => {
  const weeks = () => getCalendarWeeks(props.month.getFullYear(), props.month.getMonth());

  return (
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-0.5">
          <button type="button" class={navButtonClass} onClick={props.onPrevYear}>
            <ChevronsLeft class="h-4 w-4" />
          </button>
          <button type="button" class={navButtonClass} onClick={props.onPrevMonth}>
            <ChevronLeft class="h-4 w-4" />
          </button>
        </div>

        <div class="text-sm font-medium">{formatMonthYear(props.month)}</div>

        <div class="flex items-center gap-0.5">
          <button type="button" class={navButtonClass} onClick={props.onNextMonth}>
            <ChevronRight class="h-4 w-4" />
          </button>
          <button type="button" class={navButtonClass} onClick={props.onNextYear}>
            <ChevronsRight class="h-4 w-4" />
          </button>
        </div>
      </div>

      <table class="w-full border-collapse space-y-1">
        <thead>
          <tr class="flex w-full justify-between">
            <For each={WEEK_DAYS}>
              {(day) => (
                <th class="w-8 text-[0.8rem] font-normal text-muted-foreground text-center flex-1">
                  {day}
                </th>
              )}
            </For>
          </tr>
        </thead>
        <tbody class="flex flex-col gap-1 mt-2">
          <For each={weeks()}>
            {(week) => (
              <tr class="flex w-full">
                <For each={week}>
                  {(date) => (
                    <DayCell
                      date={date}
                      month={props.month}
                      startDate={props.startDate}
                      endDate={props.endDate}
                      hoveredDate={props.hoveredDate}
                      allowFuture={props.allowFuture}
                      onSelect={props.onDateSelect}
                      onHover={props.onDateHover}
                    />
                  )}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
};
