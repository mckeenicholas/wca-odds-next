import type { PersonRankInfo, PersonSearchResult } from "./types";
import { createContext, useContext, type Accessor } from "solid-js";

interface PersonalRankingsContextValue {
  selectedPerson: Accessor<PersonSearchResult | undefined>;
  committedDate: Accessor<Date>;
  isPending: Accessor<boolean>;
  isError: Accessor<boolean>;
  error: Accessor<string | undefined>;
  data: Accessor<PersonRankInfo[] | undefined>;
}

const PersonalRankingsContext = createContext<PersonalRankingsContextValue>();

export const PersonalRankingsProvider = PersonalRankingsContext.Provider;

export function usePersonalRankings() {
  const ctx = useContext(PersonalRankingsContext);
  if (!ctx) {
    throw new Error("usePersonalRankings must be used within a PersonalRankingsProvider");
  }
  return ctx;
}
