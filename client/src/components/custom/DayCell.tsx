import type { Component } from "solid-js";
import { getDayState, isSameDay, isToday, type DayState } from "../../lib/dateUtils";
import { cn } from "../../lib/utils";

interface DayCellProps {
  date: Date;
  month: Date;
  startDate: Date | undefined;
  endDate: Date | undefined;
  hoveredDate: Date | undefined;
  allowFuture: boolean | undefined;
  onSelect: (date: Date) => void;
  onHover: (date?: Date) => void;
}

function getCellClass(state: DayState, props: DayCellProps): string {
  const { isStart, isEnd, inRange, inHover } = state;
  const hoverExtendsForward =
    !props.endDate &&
    props.hoveredDate !== undefined &&
    props.startDate !== undefined &&
    props.hoveredDate > props.startDate;

  return cn(
    "relative flex h-8 flex-1 items-center justify-center p-0 text-center text-sm",
    (inRange || inHover) && "bg-accent text-accent-foreground",
    isStart && (props.endDate ?? hoverExtendsForward) && "rounded-l-md",
    isEnd && "rounded-r-md",
    hoverExtendsForward && isSameDay(props.date, props.hoveredDate) && "rounded-r-md",
  );
}

function getButtonClass(state: DayState, date: Date): string {
  const { isStart, isEnd, inRange, inHover, isOutside, isDisabled } = state;
  const isSelected = isStart || isEnd;

  return cn(
    "flex h-8 w-8 items-center justify-center p-0 text-center text-xs font-normal transition-colors",
    isToday(date) &&
      !isSelected &&
      "rounded-md bg-secondary font-semibold text-secondary-foreground",
    isSelected &&
      "rounded-md bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
    (inRange || inHover) && !isSelected && "rounded-none",
    !isSelected &&
      !isToday(date) &&
      !(inRange || inHover) &&
      "rounded-md hover:bg-accent hover:text-accent-foreground",
    isOutside && "text-muted-foreground opacity-50",
    isDisabled && "cursor-not-allowed text-muted-foreground opacity-20",
  );
}

export const DayCell: Component<DayCellProps> = (props) => {
  const state = () =>
    getDayState(
      props.date,
      props.month,
      props.startDate,
      props.endDate,
      props.hoveredDate,
      props.allowFuture,
    );

  return (
    <td class={getCellClass(state(), props)}>
      <button
        type="button"
        onClick={() => {
          props.onSelect(props.date);
        }}
        onMouseEnter={() => {
          if (!state().isDisabled) {
            props.onHover(props.date);
          }
        }}
        onMouseLeave={() => {
          props.onHover();
        }}
        disabled={state().isDisabled}
        class={getButtonClass(state(), props.date)}
      >
        {props.date.getDate()}
      </button>
    </td>
  );
};
