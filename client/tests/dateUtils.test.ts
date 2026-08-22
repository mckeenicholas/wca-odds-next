import { describe, it, expect } from "bun:test";
import {
  isSameDay,
  isToday,
  isFuture,
  addMonths,
  addYears,
  getCalendarWeeks,
  formatMonthYear,
  formatDateRange,
  getDayState,
  toNaiveDate,
  formatDate,
} from "../src/lib/dateUtils";

describe("dateUtils", () => {
  describe("isSameDay", () => {
    it("returns true for identical dates", () => {
      const d1 = new Date(2025, 0, 15, 10, 30);
      const d2 = new Date(2025, 0, 15, 18, 45);
      expect(isSameDay(d1, d2)).toBe(true);
    });

    it("returns false for different days", () => {
      const d1 = new Date(2025, 0, 15);
      const d2 = new Date(2025, 0, 16);
      expect(isSameDay(d1, d2)).toBe(false);
    });

    it("returns false if either date is undefined or null", () => {
      const d = new Date(2025, 0, 15);
      const noDate: Date | undefined = undefined;
      expect(isSameDay(d, noDate)).toBe(false);
      expect(isSameDay(null, d)).toBe(false);
      expect(isSameDay(null, noDate)).toBe(false);
    });
  });

  describe("isToday", () => {
    it("returns true for today and false for past/future", () => {
      const today = new Date();
      const past = new Date(2020, 0, 1);
      const future = new Date(2035, 0, 1);

      expect(isToday(today)).toBe(true);
      expect(isToday(past)).toBe(false);
      expect(isToday(future)).toBe(false);
    });
  });

  describe("isFuture", () => {
    it("detects future dates relative to today", () => {
      const past = new Date(2020, 0, 1);
      const future = new Date(2035, 0, 1);
      const today = new Date();

      expect(isFuture(future)).toBe(true);
      expect(isFuture(past)).toBe(false);
      expect(isFuture(today)).toBe(false);
    });
  });

  describe("addMonths & addYears", () => {
    it("adds months correctly", () => {
      const d = new Date(2025, 0, 15);
      const nextMonth = addMonths(d, 2);
      expect(nextMonth.getFullYear()).toBe(2025);
      expect(nextMonth.getMonth()).toBe(2);
      expect(nextMonth.getDate()).toBe(1);

      const prevMonth = addMonths(d, -1);
      expect(prevMonth.getFullYear()).toBe(2024);
      expect(prevMonth.getMonth()).toBe(11);
    });

    it("adds years correctly", () => {
      const d = new Date(2025, 5, 15);
      const nextYear = addYears(d, 2);
      expect(nextYear.getFullYear()).toBe(2027);
      expect(nextYear.getMonth()).toBe(5);
      expect(nextYear.getDate()).toBe(1);
    });
  });

  describe("getCalendarWeeks", () => {
    it("generates full calendar grid weeks of 7 days each", () => {
      // January 2025 starts on a Wednesday (day 3), ends on Friday (day 5)
      const weeks = getCalendarWeeks(2025, 0);
      expect(weeks.length).toBeGreaterThanOrEqual(4);
      for (const week of weeks) {
        expect(week.length).toBe(7);
      }

      // First day of first week should be Sunday (day 0)
      expect(weeks[0][0].getDay()).toBe(0);
      // Last day of last week should be Saturday (day 6)
      const lastWeek = weeks.at(-1);
      expect(lastWeek?.[6].getDay()).toBe(6);
    });
  });

  describe("formatMonthYear", () => {
    it("formats month and year in English", () => {
      const d = new Date(2025, 0, 15);
      expect(formatMonthYear(d)).toBe("January 2025");
    });
  });

  describe("formatDateRange", () => {
    it("handles undefined start", () => {
      const noDate: Date | undefined = undefined;
      expect(formatDateRange(noDate, noDate)).toBe("Pick a date");
    });

    it("handles single date without end", () => {
      const start = new Date(2025, 0, 15);
      const noEnd: Date | undefined = undefined;
      const result = formatDateRange(start, noEnd);
      expect(result).toContain("2025");
      expect(result).toContain("Jan");
    });

    it("handles full date range", () => {
      const start = new Date(2025, 0, 15);
      const end = new Date(2025, 0, 20);
      const result = formatDateRange(start, end);
      expect(result).toContain(" - ");
    });
  });

  describe("getDayState", () => {
    const month = new Date(2025, 0, 1);
    const start = new Date(2025, 0, 10);
    const end = new Date(2025, 0, 15);

    it("correctly flags start, end, inRange, and outside days", () => {
      const startState = getDayState(start, month, start, end, undefined, true);
      expect(startState.isStart).toBe(true);
      expect(startState.inRange).toBe(true);
      expect(startState.isOutside).toBe(false);

      const endState = getDayState(end, month, start, end, undefined, true);
      expect(endState.isEnd).toBe(true);
      expect(endState.inRange).toBe(true);

      const midDate = new Date(2025, 0, 12);
      const midState = getDayState(midDate, month, start, end, undefined, true);
      expect(midState.inRange).toBe(true);
      expect(midState.isStart).toBe(false);
      expect(midState.isEnd).toBe(false);

      const outsideDate = new Date(2024, 11, 31);
      const outsideState = getDayState(outsideDate, month, start, end, undefined, true);
      expect(outsideState.isOutside).toBe(true);
    });

    it("flags hover range when start is set without end", () => {
      const hover = new Date(2025, 0, 14);
      const testDate = new Date(2025, 0, 12);

      const state = getDayState(testDate, month, start, undefined, hover, true);
      expect(state.inHover).toBe(true);
    });

    it("disables future dates when allowFuture is false", () => {
      const futureDate = new Date(2035, 0, 1);
      const state = getDayState(futureDate, month, start, end, undefined, false);
      expect(state.isDisabled).toBe(true);
    });
  });

  describe("toNaiveDate", () => {
    it("formats Date to zero-padded YYYY-MM-DD", () => {
      const d = new Date(2025, 0, 5);
      expect(toNaiveDate(d)).toBe("2025-01-05");

      const d2 = new Date(2025, 10, 25);
      expect(toNaiveDate(d2)).toBe("2025-11-25");
    });
  });

  describe("formatDate", () => {
    it("formats string YYYY-MM-DD dates", () => {
      const formatted = formatDate("2025-01-15");
      expect(formatted).toContain("Jan");
      expect(formatted).toContain("15");
      expect(formatted).toContain("2025");
    });

    it("formats Date instances and timestamps", () => {
      const d = new Date(2025, 5, 20);
      expect(formatDate(d)).toContain("Jun");
      expect(formatDate(d.getTime())).toContain("Jun");
    });
  });
});
