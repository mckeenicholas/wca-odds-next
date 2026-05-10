import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { toRaw } from "vue";
import type {
  ChartPoint,
  SimulationAPIResults,
  SimulationRouteQuery,
  SupportedWCAEvent,
  Wcif,
} from "./types";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
export const WCA_API_BASE = "https://api.worldcubeassociation.org";

export const BREAKPOINT = 1255 as const;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetchWCIF = async (id: string): Promise<Wcif> => {
  const wcaURL = `https://api.worldcubeassociation.org/competitions/${id}/wcif/public`;
  return await fetchWCAInfo<Wcif>(wcaURL);
};

export const fetchWCAInfo = async <T>(url: string | URL): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `WCA API request failed: ${response.status} ${response.statusText}`,
    );
  }
  const data: T = await response.json();
  return data;
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
  const hexCodes = [];
  const step = 360 / num;
  for (let i = 0; i < num; i++) {
    const hue = i * step;
    hexCodes.push(hslToHex(hue, 100, 50));
  }
  return hexCodes;
};

export const toClockFormat = (centiseconds: number): string => {
  if (centiseconds === -1) return "DNF";
  if (centiseconds === -2) return "DNS";
  if (!Number.isFinite(centiseconds)) {
    throw new TypeError(
      `Invalid centiseconds, expected positive number, got ${centiseconds}.`,
    );
  }
  return new Date(centiseconds * 10)
    .toISOString()
    .slice(11, 22)
    .replaceAll(/^[0:]*(?!\.)/g, "");
};

export const toFMC = (result: number): string => {
  if (result === -1) return "DNF";
  if (result === -2) return "DNS";

  if (result % 100 === 30) {
    return ((result + 3) / 100).toString();
  }

  if (result % 100 === 60) {
    return ((result + 7) / 100).toString();
  }

  return (result / 100).toFixed(2);
};

export const renderTime = (time: number, isFMC: boolean) => {
  return isFMC ? toFMC(time) : toClockFormat(time);
};

export function times<T>(n: number, iteratee: (index: number) => T): T[] {
  return Array.from({ length: n }, (_, index) => iteratee(index));
}

export const generateDefaultTimesArray = (
  competitorsCount: number,
  attempts: number,
) => {
  return Array.from({ length: competitorsCount }, () =>
    Array.from({ length: attempts }, () => 0),
  );
};

export const getNumericValue = (val: string | number): number => {
  if (typeof val === "string") {
    return parseFloat(val);
  }
  return val;
};

export const formatPercentage = (
  val: string | number,
  normalize = false,
): string => {
  const numVal = getNumericValue(val);
  const pctVal = normalize ? numVal * 100 : numVal;

  return `${pctVal.toFixed(2)}%`;
};

export const getParentPath = (path: string) => {
  const normalizedPath = path.endsWith("/") ? path : `${path}/`;

  if (normalizedPath.includes("/results/")) {
    return normalizedPath
      .slice(0, normalizedPath.lastIndexOf("/results/"))
      .replace(/\/$/, "");
  } else if (normalizedPath.startsWith("/competition/")) {
    return "/";
  } else if (normalizedPath === "/custom/" || normalizedPath === "/custom") {
    return "/";
  }

  return "/";
};

export const arrEq2D = (arr1: number[][], arr2: number[][]): boolean => {
  if (arr1 === arr2) return true;
  if (!arr1 || !arr2) return false;
  if (arr1.length !== arr2.length) return false;

  for (let i = 0; i < arr1.length; i++) {
    const row1 = arr1[i];
    const row2 = arr2[i];

    if (row1.length !== row2.length) return false;

    for (let j = 0; j < row1.length; j++) {
      if (row1[j] !== row2[j]) return false;
    }
  }

  return true;
};

export const clone2DArr = (arr: number[][]): number[][] => {
  return arr.map((row) => [...row]);
};

export const formatDate = (date: string | Date | number) =>
  new Date(date).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

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
}): SimulationRouteQuery => {
  return {
    name: params.name,
    ...(params.competitionId && { competitionId: params.competitionId }),
    ...(params.date && { date: params.date }),
    eventId: params.eventId,
    startDate: params.startDate.toISOString(),
    endDate: params.endDate.toISOString(),
    includeDnf: params.includeDnf.toString(),
    decayRate: params.decayRate.toString(),
    competitors: params.competitors.join(","),
  };
};

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

  const rows = results.competitor_results.map((result, idx) => {
    return [
      ids[idx],
      result.name,
      result.win_chance,
      result.pod_chance,
      result.mean_no_dnf,
      result.expected_rank,
      ...currentTimes[idx],
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
};

export const downloadTextBlob = (
  data: string,
  filename: string,
  mimeType: string,
): void => {
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

export const formatInputtedTimes = (
  inputtedTimes: number[][],
  event: SupportedWCAEvent,
) => {
  const timesArray = toRaw(inputtedTimes);

  if (event !== "333fm") {
    return timesArray;
  }

  return timesArray.map((person) => person.map((time) => time * 100));
};

export const computeCDF = (data: ChartPoint[]): ChartPoint[] => {
  if (data.length === 0) {
    return [];
  }

  const runningTotals: number[] = Array.from(
    { length: data[0].values.length },
    () => 0,
  );

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

export const toNaiveDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const isToday = (date: Date): boolean =>
  date.toDateString() === new Date().toDateString();

export const isTimeEvent = (event: string) => {
  switch (event) {
    case "all":
    case "kinch":
    case "kinch_strict":
      return false;
    default:
      return true;
  }
};
