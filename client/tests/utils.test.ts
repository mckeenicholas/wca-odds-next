import type { SimulationAPIResults } from "../src/lib/types";
import { describe, it, expect } from "bun:test";
import {
  toClockFormat,
  renderTime,
  buildUrl,
  cn,
  buildSimulationQuery,
  getParentPath,
  isTimeEvent,
  generateDefaultTimesArray,
  arrEq2D,
  clone2DArr,
  createJSONExport,
  createCSVExport,
  formatInputtedTimes,
  computeCDF,
  generateColors,
  formatPercentage,
  toInt,
} from "../src/lib/utils";

describe("utils", () => {
  describe("toClockFormat", () => {
    it("handles DNF and DNS sentinel values", () => {
      expect(toClockFormat(-1)).toBe("DNF");
      expect(toClockFormat(-2)).toBe("DNS");
    });

    it("formats centiseconds to seconds.cs", () => {
      expect(toClockFormat(523)).toBe("5.23");
      expect(toClockFormat(999)).toBe("9.99");
      expect(toClockFormat(500)).toBe("5.00");
    });

    it("formats times over one minute", () => {
      // 65.23s = 6523 centiseconds -> 1:05.23
      expect(toClockFormat(6523)).toBe("1:05.23");
      // 120.00s = 12000 cs -> 2:00.00
      expect(toClockFormat(12_000)).toBe("2:00.00");
    });

    it("formats times over one hour", () => {
      // 1 hr 1 min 5.23s = (3600 + 60 + 5.23) * 100 = 366523 cs -> 1:01:05.23
      expect(toClockFormat(366_523)).toBe("1:01:05.23");
    });

    it("throws on non-finite values", () => {
      expect(() => toClockFormat(NaN)).toThrow(TypeError);
      expect(() => toClockFormat(Infinity)).toThrow(TypeError);
    });
  });

  describe("renderTime", () => {
    it("renders standard clock format when isFMC is false", () => {
      expect(renderTime(523, false)).toBe("5.23");
      expect(renderTime(-1, false)).toBe("DNF");
    });

    it("renders FMC moves when isFMC is true", () => {
      expect(renderTime(-1, true)).toBe("DNF");
      expect(renderTime(-2, true)).toBe("DNS");
      expect(renderTime(2500, true)).toBe("25.00");
      // FMC modulo 30 and 60 adjustments
      expect(renderTime(2530, true)).toBe("25.33");
      expect(renderTime(2560, true)).toBe("25.67");
      expect(renderTime(2501, true)).toBe("25.01");
    });
  });

  describe("buildUrl", () => {
    it("builds URL with query parameters and filters undefined/null", () => {
      const url = buildUrl("/api/search", {
        q: "Feliks",
        page: 1,
        active: true,
        extra: undefined,
        nullVal: null,
      });

      const parsed = new URL(url);
      expect(parsed.pathname).toBe("/api/search");
      expect(parsed.searchParams.get("q")).toBe("Feliks");
      expect(parsed.searchParams.get("page")).toBe("1");
      expect(parsed.searchParams.get("active")).toBe("true");
      expect(parsed.searchParams.has("extra")).toBe(false);
      expect(parsed.searchParams.has("nullVal")).toBe(false);
    });
  });

  describe("cn", () => {
    it("merges class names with tailwind-merge", () => {
      const showHidden = false;
      expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
      expect(cn("text-red-500", undefined, "text-blue-500")).toBe("text-blue-500");
      expect(cn("font-bold", showHidden && "hidden")).toBe("font-bold");
    });
  });

  describe("buildSimulationQuery", () => {
    it("builds query object with serialized params", () => {
      const start = new Date("2024-01-01T00:00:00Z");
      const end = new Date("2025-01-01T00:00:00Z");
      const query = buildSimulationQuery({
        name: "World Championship",
        eventId: "333",
        startDate: start,
        endDate: end,
        includeDnf: true,
        decayRate: 90,
        competitors: ["2015MCKE02", "2003POWL01"],
        competitionId: "WC2025",
        date: "2025-01-01",
      });

      expect(query.name).toBe("World Championship");
      expect(query.eventId).toBe("333");
      expect(query.startDate).toBe(start.toISOString());
      expect(query.endDate).toBe(end.toISOString());
      expect(query.includeDnf).toBe("true");
      expect(query.decayRate).toBe("90");
      expect(query.competitors).toBe("2015MCKE02,2003POWL01");
      expect(query.competitionId).toBe("WC2025");
      expect(query.date).toBe("2025-01-01");
    });
  });

  describe("getParentPath", () => {
    it("handles /results/ paths", () => {
      expect(getParentPath("/competition/WC2025/results/333")).toBe("/competition/WC2025");
      expect(getParentPath("/custom/results/333/")).toBe("/custom");
    });

    it("handles /competition/ paths", () => {
      expect(getParentPath("/competition/WC2025")).toBe("/");
      expect(getParentPath("/competition/WC2025/")).toBe("/");
    });

    it("handles /custom paths", () => {
      expect(getParentPath("/custom")).toBe("/");
      expect(getParentPath("/custom/")).toBe("/");
    });
  });

  describe("isTimeEvent", () => {
    it("returns false for kinch/all events, true for speedcubing events", () => {
      expect(isTimeEvent("all")).toBe(false);
      expect(isTimeEvent("kinch")).toBe(false);
      expect(isTimeEvent("kinch_strict")).toBe(false);
      expect(isTimeEvent("333")).toBe(true);
      expect(isTimeEvent("222")).toBe(true);
      expect(isTimeEvent("333bf")).toBe(true);
      expect(isTimeEvent("333fm")).toBe(true);
    });
  });

  describe("generateDefaultTimesArray", () => {
    it("creates a 2D array of zeros with given dimensions", () => {
      const arr = generateDefaultTimesArray(3, 5);
      expect(arr.length).toBe(3);
      expect(arr[0]).toEqual([0, 0, 0, 0, 0]);
      expect(arr[1]).toEqual([0, 0, 0, 0, 0]);
      expect(arr[2]).toEqual([0, 0, 0, 0, 0]);
    });
  });

  describe("arrEq2D & clone2DArr", () => {
    it("compares 2D arrays correctly", () => {
      const a = [
        [1, 2],
        [3, 4],
      ];
      const b = [
        [1, 2],
        [3, 4],
      ];
      const c = [
        [1, 2],
        [3, 5],
      ];
      const d = [[1, 2]];

      expect(arrEq2D(a, a)).toBe(true);
      expect(arrEq2D(a, b)).toBe(true);
      expect(arrEq2D(a, c)).toBe(false);
      expect(arrEq2D(a, d)).toBe(false);
    });

    it("clones 2D array independently", () => {
      const original = [
        [1, 2],
        [3, 4],
      ];
      const clone = clone2DArr(original);

      expect(clone).toEqual(original);
      clone[0][0] = 99;
      expect(original[0][0]).toBe(1);
    });
  });

  describe("createJSONExport & createCSVExport", () => {
    const mockResults: SimulationAPIResults = {
      competitor_results: [
        {
          name: "Alice",
          id: "2015ALIC01",
          country_iso2: "US",
          win_chance: 0.85,
          pod_chance: 0.99,
          expected_rank: 1.2,
          sample_size: 50,
          mean_no_dnf: 850,
          histogram: { labels: [], data: [] },
        },
      ],
      full_histogram: {
        single: { labels: [], data: [] },
        average: { labels: [], data: [] },
      },
      rank_histogram: { labels: [], data: [] },
    };

    it("creates valid JSON export", () => {
      const jsonStr = createJSONExport({
        competitionName: "US Nationals",
        results: mockResults,
        ids: ["2015ALIC01"],
        currentTimes: [[800, 850, 900, 0, 0]],
        startDate: new Date("2024-01-01"),
        endDate: new Date("2025-01-01"),
        decayRate: 90,
        includeDnf: true,
        event: "333",
      });

      const parsed = JSON.parse(jsonStr);
      expect(parsed.config.competitionName).toBe("US Nationals");
      expect(parsed.config.event).toBe("333");
      expect(parsed.results.length).toBe(1);
      expect(parsed.results[0].name).toBe("Alice");
      expect(parsed.results[0].enteredTimes).toEqual([800, 850, 900]);
    });

    it("creates valid CSV export", () => {
      const csvStr = createCSVExport(mockResults, ["2015ALIC01"], [[800, 850, 900, 0, 0]]);
      const lines = csvStr.split("\n");
      expect(lines[0]).toBe(
        "id,name,win_chance,podium_chance,global_mean,expected_rank,time_1,time_2,time_3,time_4,time_5",
      );
      expect(lines[1]).toBe("2015ALIC01,Alice,0.85,0.99,850,1.2,800,850,900,0,0");
    });
  });

  describe("formatInputtedTimes", () => {
    it("multiplies times by 100 for FMC", () => {
      const times = [[25, 26, 27]];
      expect(formatInputtedTimes(times, "333fm")).toEqual([[2500, 2600, 2700]]);
    });

    it("leaves times unchanged for other events", () => {
      const times = [[800, 850, 900]];
      expect(formatInputtedTimes(times, "333")).toEqual([[800, 850, 900]]);
    });
  });

  describe("computeCDF", () => {
    it("returns empty array for empty input", () => {
      expect(computeCDF([])).toEqual([]);
    });

    it("computes cumulative sums across points for each series", () => {
      const data = [
        { name: "1", values: [10, 20] },
        { name: "2", values: [30, 40] },
        { name: "3", values: [50, 10] },
      ];

      const cdf = computeCDF(data);
      expect(cdf[0].values).toEqual([10, 20]);
      expect(cdf[1].values).toEqual([40, 60]);
      expect(cdf[2].values).toEqual([90, 70]);
    });
  });

  describe("generateColors", () => {
    it("generates correct number of hex color strings", () => {
      const colors = generateColors(5);
      expect(colors.length).toBe(5);
      for (const color of colors) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/iu);
      }
    });
  });

  describe("formatPercentage", () => {
    it("formats percentage with and without normalization", () => {
      expect(formatPercentage(50.5)).toBe("50.50%");
      expect(formatPercentage(0.505, true)).toBe("50.50%");
    });
  });

  describe("toInt", () => {
    it("parses integer strings with truncation", () => {
      expect(toInt("42", 0)).toBe(42);
      expect(toInt("42.8", 0)).toBe(42);
      expect(toInt("-5", 0)).toBe(-5);
    });

    it("returns default on null, undefined, or NaN", () => {
      expect(toInt(null, 10)).toBe(10);
      expect(toInt(undefined, 20)).toBe(20);
      expect(toInt("not-a-number", 30)).toBe(30);
      expect(toInt(null, null)).toBe(null);
    });
  });
});
