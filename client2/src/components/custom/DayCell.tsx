import type { Component } from "solid-js";
import { cn } from "../../lib/utils";
import { getDayState, isSameDay, isToday, type DayState } from "../../lib/dateUtils";

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
    "relative p-0 text-center text-sm flex-1 flex items-center justify-center h-8",
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
    "h-8 w-8 p-0 font-normal transition-colors flex items-center justify-center text-center text-xs",
    isToday(date) &&
      !isSelected &&
      "bg-secondary text-secondary-foreground font-semibold rounded-md",
    isSelected &&
      "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
    (inRange || inHover) && !isSelected && "rounded-none",
    !isSelected &&
      !isToday(date) &&
      !(inRange || inHover) &&
      "rounded-md hover:bg-accent hover:text-accent-foreground",
    isOutside && "text-muted-foreground opacity-50",
    isDisabled && "text-muted-foreground opacity-20 cursor-not-allowed",
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
