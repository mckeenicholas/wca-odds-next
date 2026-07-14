import type {
  Wcif,
  SimulationRouteQuery,
  SimulationAPIResults,
  SupportedWCAEvent,
  ChartPoint,
} from "./types";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
export const API_URL = import.meta.env.VITE_API_URL ?? "https://odds.nmckee.org";
export const WCA_API_BASE = "https://api.worldcubeassociation.org";

export const BREAKPOINT = 1255 as const;

export function buildUrl(
  path: string,
  params: Record<string, string | number | boolean | undefined | null> = {},
): string {
  const url = new URL(path, API_URL);

  const cleanParams = Object.fromEntries(
    Object.entries(params)
      .filter(([_, val]) => val !== undefined && val !== null)
      .map(([key, val]) => [key, String(val)]),
  );

  url.search = new URLSearchParams(cleanParams).toString();

  return url.href;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetchWCAInfo = async <T>(url: string | URL): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`WCA API request failed: ${response.status} ${response.statusText}`);
  }
  const data: T = await response.json();
  return data;
};

export const fetchWCIF = async (id: string): Promise<Wcif> => {
  const wcaURL = `https://api.worldcubeassociation.org/competitions/${id}/wcif/public`;
  return fetchWCAInfo<Wcif>(wcaURL);
};

export const buildSimulationQuery = (params: {
  name: string;
  eventId: string;
  startDate: Date;
  endDate: Date;
  includeDnf: boolean;
  decayRate: number;
  competitors: string[];
  competitionId?: string;
  date?: string;
}): SimulationRouteQuery => ({
  name: params.name,
  ...(params.competitionId && { competitionId: params.competitionId }),
  ...(params.date && { date: params.date }),
  eventId: params.eventId,
  startDate: params.startDate.toISOString(),
  endDate: params.endDate.toISOString(),
  includeDnf: params.includeDnf.toString(),
  decayRate: params.decayRate.toString(),
  competitors: params.competitors.join(","),
});

export const getParentPath = (path: string) => {
  const normalizedPath = path.endsWith("/") ? path : `${path}/`;

  if (normalizedPath.includes("/results/")) {
    return normalizedPath.slice(0, normalizedPath.lastIndexOf("/results/")).replace(/\/$/u, "");
  } else if (normalizedPath.startsWith("/competition/")) {
    return "/";
  } else if (normalizedPath === "/custom/" || normalizedPath === "/custom") {
    return "/";
  }

  return "/";
};

export const formatDate = (date: string | Date | number) => {
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

export const toClockFormat = (centiseconds: number): string => {
  if (centiseconds === -1) {
    return "DNF";
  }
  if (centiseconds === -2) {
    return "DNS";
  }
  if (!Number.isFinite(centiseconds)) {
    throw new TypeError(`Invalid centiseconds, expected positive number, got ${centiseconds}.`);
  }
  return new Date(centiseconds * 10)
    .toISOString()
    .slice(11, 22)
    .replaceAll(/^[0:]*(?!\.)/gu, "");
};

export const toFMC = (result: number): string => {
  if (result === -1) {
    return "DNF";
  }
  if (result === -2) {
    return "DNS";
  }

  if (result % 100 === 30) {
    return ((result + 3) / 100).toString();
  }

  if (result % 100 === 60) {
    return ((result + 7) / 100).toString();
  }

  return (result / 100).toFixed(2);
};

export const renderTime = (time: number, isFMC: boolean) =>
  isFMC ? toFMC(time) : toClockFormat(time);

export const toNaiveDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const isToday = (date: Date): boolean => date.toDateString() === new Date().toDateString();

export const isTimeEvent = (event: string) => {
  switch (event) {
    case "all":
    case "kinch":
    case "kinch_strict": {
      return false;
    }
    default: {
      return true;
    }
  }
};

export const generateDefaultTimesArray = (competitorsCount: number, attempts: number) =>
  Array.from({ length: competitorsCount }, () => Array.from({ length: attempts }, () => 0));

export const arrEq2D = (arr1: number[][], arr2: number[][]): boolean => {
  if (arr1 === arr2) {
    return true;
  }
  if (!arr1 || !arr2) {
    return false;
  }
  if (arr1.length !== arr2.length) {
    return false;
  }

  return arr1.every((row1, i) => {
    const row2 = arr2[i];
    return row1.length === row2.length && row1.every((val, j) => val === row2[j]);
  });
};

export const clone2DArr = (arr: number[][]): number[][] => arr.map((row) => [...row]);

export const createJSONExport = ({
  competitionName,
  results,
  ids,
  currentTimes,
  startDate,
  endDate,
  decayRate,
  includeDnf,
  event,
}: {
  competitionName: string;
  results: SimulationAPIResults;
  ids: string[];
  currentTimes: number[][];
  startDate: Date;
  endDate: Date;
  decayRate: number;
  includeDnf: boolean;
  event: SupportedWCAEvent;
}) => {
  const config = {
    competitionName,
    decayRate,
    endDate,
    event,
    generatedOn: new Date(),
    includeDnf,
    startDate,
  };

  const personResults = results.competitor_results.map((result, index) => ({
    enteredTimes: currentTimes[index].filter((time) => time !== 0),
    expectedRank: result.expected_rank,
    globalMean: result.mean_no_dnf,
    id: ids[index],
    name: result.name,
    podiumChance: result.pod_chance,
    winChance: result.win_chance,
  }));

  return JSON.stringify({
    config,
    results: personResults,
  });
};

export const createCSVExport = (
  results: SimulationAPIResults,
  ids: string[],
  currentTimes: number[][],
) => {
  const headers = [
    "id",
    "name",
    "win_chance",
    "podium_chance",
    "global_mean",
    "expected_rank",
    "time_1",
    "time_2",
    "time_3",
    "time_4",
    "time_5",
  ];

  const rows = results.competitor_results.map((result, idx) =>
    [
      ids[idx],
      result.name,
      result.win_chance,
      result.pod_chance,
      result.mean_no_dnf,
      result.expected_rank,
      ...currentTimes[idx],
    ].join(","),
  );

  return [headers.join(","), ...rows].join("\n");
};

export const downloadTextBlob = (data: string, filename: string, mimeType: string): void => {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";

  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
};

export const formatInputtedTimes = (inputtedTimes: number[][], event: SupportedWCAEvent) => {
  if (event !== "333fm") {
    return inputtedTimes;
  }

  return inputtedTimes.map((person) => person.map((time) => time * 100));
};

export const computeCDF = (data: ChartPoint[]): ChartPoint[] => {
  if (data.length === 0) {
    return [];
  }

  const runningTotals: number[] = Array.from({ length: data[0].values.length }, () => 0);

  return data.map((point) => {
    const newValues = point.values.map((val, j) => {
      runningTotals[j] += val;
      return runningTotals[j];
    });

    return {
      ...point,
      values: newValues,
    };
  });
};

const hslToHex = (h: number, s: number, l: number) => {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

export const generateColors = (num: number) => {
  const step = 360 / num;
  return Array.from({ length: num }, (_, i) => hslToHex(i * step, 100, 50));
};

export const formatPercentage = (val: number, normalize = false): string => {
  const pctVal = normalize ? val * 100 : val;
  return `${pctVal.toFixed(2)}%`;
};

export function toInt(value: string | null | undefined, defaultVal: number): number;
export function toInt(value: string | null | undefined, defaultVal?: null): number | null;
export function toInt(
  value: string | null | undefined,
  defaultVal: number | null = null,
): number | null {
  if (value === null || value === undefined) {
    return defaultVal;
  }

  const numVal = Number(value);

  if (Number.isNaN(numVal)) {
    return defaultVal;
  }

  return Math.trunc(numVal);
}
