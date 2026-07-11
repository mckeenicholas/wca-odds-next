import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Wcif, SimulationRouteQuery } from "./types";

// Export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
export const API_URL = import.meta.env.VITE_API_URL ?? "https://odds.nmckee.org";
export const WCA_API_BASE = "https://api.worldcubeassociation.org";

export const BREAKPOINT = 1255 as const;

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
