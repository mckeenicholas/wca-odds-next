import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Wcif, SimulationRouteQuery } from "./types";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
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
  return await fetchWCAInfo<Wcif>(wcaURL);
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

export const getParentPath = (path: string) => {
  const normalizedPath = path.endsWith("/") ? path : `${path}/`;

  if (normalizedPath.includes("/results/")) {
    return normalizedPath.slice(0, normalizedPath.lastIndexOf("/results/")).replace(/\/$/, "");
  } else if (normalizedPath.startsWith("/competition/")) {
    return "/";
  } else if (normalizedPath === "/custom/" || normalizedPath === "/custom") {
    return "/";
  }

  return "/";
};

export const formatDate = (date: string | Date | number) => {
  const d =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(date + "T12:00:00")
      : new Date(date);
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};
