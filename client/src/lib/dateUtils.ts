export function clearTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isSameDay(d1: Date | undefined | null, d2: Date | undefined | null): boolean {
  if (!d1 || !d2) {
    return false;
  }
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

export function isFuture(d: Date): boolean {
  return clearTime(d) > clearTime(new Date());
}

export function isInRange(d: Date, start: Date | undefined, end: Date | undefined): boolean {
  if (!start || !end) {
    return false;
  }
  const t = clearTime(d);
  return t >= clearTime(start) && t <= clearTime(end);
}

export function isInHoverRange(
  d: Date,
  start: Date | undefined,
  end: Date | undefined,
  hover: Date | undefined,
): boolean {
  if (!start || end || !hover) {
    return false;
  }
  const t = clearTime(d);
  const startTime = clearTime(start);
  const hoverTime = clearTime(hover);
  if (hoverTime < startTime) {
    return false;
  }
  return t >= startTime && t <= hoverTime;
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function addYears(d: Date, n: number): Date {
  return new Date(d.getFullYear() + n, d.getMonth(), 1);
}

export function getCalendarWeeks(year: number, month: number): Date[][] {
  const weeks: Date[][] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const start = new Date(firstDay);
  start.setDate(1 - firstDay.getDay());

  const end = new Date(lastDay);
  end.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

  let current = new Date(start);
  while (current <= end) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    current = new Date(current);
    weeks.push(week);
  }
  return weeks;
}

export function formatMonthYear(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(d);
}

export function formatDateRange(start: Date | undefined, end: Date | undefined): string {
  if (!start) {
    return "Pick a date";
  }
  const formattedStart = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(start);
  if (!end) {
    return formattedStart;
  }
  const formattedEnd = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(end);
  return `${formattedStart} - ${formattedEnd}`;
}

export interface DayState {
  isStart: boolean;
  isEnd: boolean;
  inRange: boolean;
  inHover: boolean;
  isOutside: boolean;
  isDisabled: boolean;
}

export function getDayState(
  date: Date,
  month: Date,
  startDate: Date | undefined,
  endDate: Date | undefined,
  hoveredDate: Date | undefined,
  allowFuture: boolean | undefined,
): DayState {
  return {
    inHover: isInHoverRange(date, startDate, endDate, hoveredDate),
    inRange: isInRange(date, startDate, endDate),
    isDisabled: !allowFuture && isFuture(date),
    isEnd: isSameDay(date, endDate),
    isOutside: date.getMonth() !== month.getMonth(),
    isStart: isSameDay(date, startDate),
  };
}

export const toNaiveDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const formatDate = (date: string | Date | number): string => {
  const d =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(date)
      ? new Date(`${date}T12:00:00`)
      : new Date(date);
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};
