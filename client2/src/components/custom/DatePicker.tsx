import { createSignal, createEffect, untrack } from "solid-js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "../../lib/utils";
import { Calendar as CalendarIcon } from "lucide-solid";
import { CalendarPanel } from "./CalendarPanel";
import { addMonths, addYears, isFuture } from "../../lib/dateUtils";

interface DatePickerProps {
  value: Date | undefined;
  onChange: (date: Date) => void;
  disabled?: boolean;
  allowFuture?: boolean;
  placeholder?: string;
}

export function DatePicker(props: DatePickerProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [hoveredDate, setHoveredDate] = createSignal<Date | undefined>();

  const initialMonth = () => {
    const d = props.value ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  };

  const [month, setMonth] = createSignal<Date>(initialMonth());

  createEffect(() => {
    const d = props.value;
    if (!d) {
      return;
    }
    const currentMonth = untrack(month);
    if (
      d.getFullYear() !== currentMonth.getFullYear() ||
      d.getMonth() !== currentMonth.getMonth()
    ) {
      setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  });

  const navigateMonth = (next: Date) => {
    setMonth(next);
  };

  const handleDateClick = (date: Date) => {
    if (!props.allowFuture && isFuture(date)) {
      return;
    }
    props.onChange(date);
    setIsOpen(false);
  };

  const formatDateLong = (d: Date | undefined) => {
    if (!d) {
      return props.placeholder ?? "Pick a date";
    }
    return d.toLocaleDateString("en-US", {
      dateStyle: "long",
    });
  };

  return (
    <Popover open={isOpen()} onOpenChange={setIsOpen} gutter={4}>
      <PopoverTrigger
        class={cn(
          "w-60 justify-start px-3 text-left font-normal h-9 flex items-center border border-input rounded-md bg-background text-sm shadow-sm ring-offset-background",
          !props.value && "text-muted-foreground",
          props.disabled && "cursor-not-allowed opacity-50",
        )}
        disabled={props.disabled}
      >
        <CalendarIcon class="h-4 w-4 me-2 opacity-50" />
        <span>{formatDateLong(props.value)}</span>
      </PopoverTrigger>

      <PopoverContent class="w-auto p-3">
        <CalendarPanel
          month={month()}
          onPrevYear={() => {
            navigateMonth(addYears(month(), -1));
          }}
          onPrevMonth={() => {
            navigateMonth(addMonths(month(), -1));
          }}
          onNextMonth={() => {
            navigateMonth(addMonths(month(), 1));
          }}
          onNextYear={() => {
            navigateMonth(addYears(month(), 1));
          }}
          startDate={props.value}
          endDate={props.value}
          hoveredDate={hoveredDate()}
          allowFuture={props.allowFuture}
          onDateSelect={handleDateClick}
          onDateHover={setHoveredDate}
        />
      </PopoverContent>
    </Popover>
  );
}
