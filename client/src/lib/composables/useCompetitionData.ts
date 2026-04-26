import type { Competitor, Person, SupportedWCAEvent, wcif } from "@/lib/types";

// Extracted from CompetitionPage.vue
type EventRegistration = Partial<Record<SupportedWCAEvent, Competitor[]>>;

const MAX_COMPETITORS = 64 as const;
const DEFAULT_SELECTED = 16 as const;

export function useCompetitionData() {
  const processCompetitor = (
    person: Person,
    event: SupportedWCAEvent,
  ): Competitor | null => {
    const worldRank = person.personalBests.find(
      (pb) => pb.eventId === event,
    )?.worldRanking;

    if (!worldRank) return null;

    return {
      id: person.wcaId,
      country: person.countryIso2,
      name: person.name,
      rank: worldRank,
      selected: false,
    };
  };

  const getCompetitorData = (
    data: wcif | undefined | null,
    isError: boolean,
    selectedEventIdRef: { value: SupportedWCAEvent },
  ): EventRegistration => {
    if (isError || !data) return {};

    const competitorAcc: EventRegistration = {};

    data.persons
      .filter(
        (person) =>
          person.registration?.status === "accepted" &&
          person.registration?.isCompeting &&
          person.wcaId,
      )
      .forEach((person) => {
        person.registration.eventIds.forEach((event: SupportedWCAEvent) => {
          if (!competitorAcc[event]) {
            competitorAcc[event] = [];
          }

          const competitor = processCompetitor(person, event);
          if (competitor) {
            competitorAcc[event]!.push(competitor);
          }
        });
      });

    Object.keys(competitorAcc).forEach((eventId) => {
      const competitors = competitorAcc[eventId as SupportedWCAEvent];
      if (competitors && competitors.length > 0) {
        competitors.sort((a, b) => a.rank - b.rank);
        competitors.forEach((c, i) => (c.selected = i < DEFAULT_SELECTED));

        if (competitors.length > MAX_COMPETITORS) {
          competitorAcc[eventId as SupportedWCAEvent] = competitors.slice(
            0,
            MAX_COMPETITORS,
          );
        }
      }
    });

    if (!("333" in competitorAcc) && Object.keys(competitorAcc).length > 0) {
      selectedEventIdRef.value = Object.keys(
        competitorAcc,
      )[0] as SupportedWCAEvent;
    }

    return competitorAcc;
  };

  return { getCompetitorData };
}
