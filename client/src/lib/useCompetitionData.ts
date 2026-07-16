import {
  type Competitor,
  type Person,
  type SupportedWCAEvent,
  type Wcif,
  supportedWCAEvents,
} from "./types";

type EventRegistration = Partial<Record<SupportedWCAEvent, Competitor[]>>;

const MAX_COMPETITORS = 64 as const;
const DEFAULT_SELECTED = 16 as const;

const processCompetitor = (person: Person, event: SupportedWCAEvent): Competitor | undefined => {
  const worldRank = person.personalBests?.find((pb) => pb.eventId === event)?.worldRanking;

  if (!worldRank) {
    return undefined;
  }

  return {
    country: person.countryIso2,
    id: person.wcaId!,
    name: person.name,
    rank: worldRank,
    selected: false,
  };
};

export function getCompetitorData(
  data: Wcif | undefined | null,
  isError: boolean,
  selectedEventId: SupportedWCAEvent,
  setSelectedEventId: (val: SupportedWCAEvent) => void,
): EventRegistration {
  if (isError || !data) {
    return {};
  }

  const competitorAcc: EventRegistration = {};

  data.persons
    .filter(
      (person) =>
        person.registration?.status === "accepted" &&
        person.registration?.isCompeting &&
        person.wcaId,
    )
    .forEach((person) => {
      person.registration?.eventIds.forEach((event) => {
        if (event === "333mbf") {
          return;
        }
        if (!supportedWCAEvents.includes(event as SupportedWCAEvent)) {
          return;
        }
        const supportedEvent = event as SupportedWCAEvent;
        competitorAcc[supportedEvent] ??= [];

        const competitor = processCompetitor(person, supportedEvent);
        if (competitor) {
          competitorAcc[supportedEvent].push(competitor);
        }
      });
    });

  Object.keys(competitorAcc).forEach((eventId) => {
    const competitors = competitorAcc[eventId as SupportedWCAEvent];
    if (competitors && competitors.length > 0) {
      competitors.sort((a, b) => a.rank - b.rank);
      competitors.forEach((c, i) => (c.selected = i < DEFAULT_SELECTED));

      if (competitors.length > MAX_COMPETITORS) {
        competitorAcc[eventId as SupportedWCAEvent] = competitors.slice(0, MAX_COMPETITORS);
      }
    }
  });

  if (!(selectedEventId in competitorAcc) && Object.keys(competitorAcc).length > 0) {
    setSelectedEventId(Object.keys(competitorAcc)[0] as SupportedWCAEvent);
  }

  return competitorAcc;
}
