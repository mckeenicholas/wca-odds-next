import { createSignal, createEffect, untrack } from "solid-js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { buttonVariants } from "../ui/button";
import { cn } from "../../lib/utils";
import { Calendar as CalendarIcon } from "lucide-solid";
import { CalendarPanel } from "./CalendarPanel";
import { addMonths, addYears, formatDateRange, isFuture } from "../../lib/dateUtils";

interface DateRangePickerProps {
  startDate: Date | undefined;
  onStartDateChange: (date?: Date) => void;
  endDate: Date | undefined;
  onEndDateChange: (date?: Date) => void;
  allowFuture?: boolean;
}

export function DateRangePicker(props: DateRangePickerProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [hoveredDate, setHoveredDate] = createSignal<Date | undefined>();

  const initialLeft = () => {
    const d = props.startDate ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  };

  const initialRight = () => {
    if (props.endDate) {
      const start = props.startDate ?? new Date();
      const end = props.endDate;
      if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
        return addMonths(start, 1);
      }
      return new Date(end.getFullYear(), end.getMonth(), 1);
    }
    return addMonths(initialLeft(), 1);
  };

  const [leftDate, setLeftDate] = createSignal<Date>(initialLeft());
  const [rightDate, setRightDate] = createSignal<Date>(initialRight());

  // Sync views when dates change from outside (only if selected dates are not currently visible)
  createEffect(() => {
    const start = props.startDate;
    if (!start) {
      return;
    }

    const isVisible = (d: Date) =>
      d.getFullYear() === start.getFullYear() && d.getMonth() === start.getMonth();

    if (!isVisible(untrack(leftDate)) && !isVisible(untrack(rightDate))) {
      setLeftDate(new Date(start.getFullYear(), start.getMonth(), 1));
      setRightDate(addMonths(start, 1));
    }
  });

  // Move a pane to `next`, nudging the other pane out of the way if the move
  // Would make them overlap. Used for both month and year navigation on
  // Both panes, replacing what were four near-identical functions.
  const navigateLeft = (next: Date) => {
    setLeftDate(next);
    if (rightDate() <= next) {
      setRightDate(addMonths(next, 1));
    }
  };

  const navigateRight = (next: Date) => {
    setRightDate(next);
    if (leftDate() >= next) {
      setLeftDate(addMonths(next, -1));
    }
  };

  const handleDateClick = (date: Date) => {
    if (!props.allowFuture && isFuture(date)) {
      return;
    }

    const startingNewRange = !props.startDate || (props.startDate && props.endDate);
    if (startingNewRange) {
      props.onStartDateChange(date);
      props.onEndDateChange();

      // If the new start date was clicked on the right pane, slide it over
      // To the left pane so the picker keeps showing two consecutive months.
      const isOnRightPane =
        rightDate().getFullYear() === date.getFullYear() &&
        rightDate().getMonth() === date.getMonth();
      if (isOnRightPane) {
        setLeftDate(new Date(date.getFullYear(), date.getMonth(), 1));
        setRightDate(addMonths(date, 1));
      }
    } else if (date < props.startDate!) {
      props.onStartDateChange(date);
    } else {
      props.onEndDateChange(date);
      setIsOpen(false);
    }
  };

  return (
    <Popover open={isOpen()} onOpenChange={setIsOpen} gutter={4}>
      <PopoverTrigger
        class={cn(
          buttonVariants({ variant: "outline" }),
          "justify-start px-3 text-left font-normal h-9",
          !props.startDate && "text-muted-foreground",
        )}
      >
        <CalendarIcon class="h-4 w-4 me-2 opacity-50" />
        <span class="text-sm">{formatDateRange(props.startDate, props.endDate)}</span>
      </PopoverTrigger>

      <PopoverContent class="w-auto p-3">
        <div class="flex flex-col gap-y-4 sm:flex-row sm:gap-x-4 sm:gap-y-0">
          <CalendarPanel
            month={leftDate()}
            onPrevYear={() => {
              navigateLeft(addYears(leftDate(), -1));
            }}
            onPrevMonth={() => {
              navigateLeft(addMonths(leftDate(), -1));
            }}
            onNextMonth={() => {
              navigateLeft(addMonths(leftDate(), 1));
            }}
            onNextYear={() => {
              navigateLeft(addYears(leftDate(), 1));
            }}
            startDate={props.startDate}
            endDate={props.endDate}
            hoveredDate={hoveredDate()}
            allowFuture={props.allowFuture}
            onDateSelect={handleDateClick}
            onDateHover={setHoveredDate}
          />

          <CalendarPanel
            month={rightDate()}
            onPrevYear={() => {
              navigateRight(addYears(rightDate(), -1));
            }}
            onPrevMonth={() => {
              navigateRight(addMonths(rightDate(), -1));
            }}
            onNextMonth={() => {
              navigateRight(addMonths(rightDate(), 1));
            }}
            onNextYear={() => {
              navigateRight(addYears(rightDate(), 1));
            }}
            startDate={props.startDate}
            endDate={props.endDate}
            hoveredDate={hoveredDate()}
            allowFuture={props.allowFuture}
            onDateSelect={handleDateClick}
            onDateHover={setHoveredDate}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
