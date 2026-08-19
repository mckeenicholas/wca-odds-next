import type {
  FetchRoundResultsGraphQLResponse,
  SupportedWCAEvent,
  WCALiveCompetitionData,
} from "./types";

const WCA_LIVE_ENDPOINT = "https://live.worldcubeassociation.org";
const WCA_LIVE_API_ENDPOINT = `${WCA_LIVE_ENDPOINT}/api`;

const fetchWCALiveResults = async (
  competitionId: string,
  event: SupportedWCAEvent,
  ids: string[],
): Promise<number[][]> => {
  const wcaLiveId = await getWCALiveID(competitionId);
  const competitionData = await fetchCompetitionRounds(wcaLiveId);

  const targetEvent = competitionData.competitionEvents.find(
    (competitionEvent) => competitionEvent.event.id === event,
  );

  if (!targetEvent?.rounds || targetEvent.rounds.length === 0) {
    throw new Error(
      `Event '${event}' not found or has no rounds in competition '${competitionId}'.`,
    );
  }

  const finalRound = targetEvent.rounds.reduce(
    (acc, round) => (round.number > acc.number ? round : acc),
    targetEvent.rounds[0],
  );

  const roundResultsResponse = (await fetchRoundResults(
    finalRound.id,
  )) as FetchRoundResultsGraphQLResponse;
  if (roundResultsResponse.errors && roundResultsResponse.errors.length > 0) {
    const errorMessages = roundResultsResponse.errors.map((e) => e.message).join("; ");
    throw new Error(`GraphQL query for round '${finalRound.id}' failed: ${errorMessages}`);
  }

  if (!roundResultsResponse.data?.round?.format) {
    throw new Error(
      `Essential data (round or format) missing in WCALive response for round '${finalRound.id}'.`,
    );
  }

  const roundDetails = roundResultsResponse.data.round;
  const { numberOfAttempts } = roundDetails.format;
  const actualRoundResultsList = roundDetails.results || [];

  const personAttemptsMap = new Map<string, number[]>(
    actualRoundResultsList
      .filter((resultItem) => resultItem.person?.wcaId && resultItem.attempts)
      .map((resultItem) => [
        resultItem.person.wcaId!,
        resultItem.attempts.map((att) => att.result),
      ]),
  );

  return ids.map((wcaId) => {
    const recordedAttempts = personAttemptsMap.get(wcaId);
    return Array.from({ length: numberOfAttempts }, (_, i) =>
      recordedAttempts && i < recordedAttempts.length ? recordedAttempts[i] : 0,
    );
  });
};

const fetchRoundResults = async (roundId: string) => {
  const query = `query Round($id: ID!) {
          round(id: $id) {
              format {
                  numberOfAttempts
              }
              results {
                  ...roundResult
              }
          }
      }
    
      fragment roundResult on Result {
          attempts {
              result
          }
          person {
              wcaId
          }
      }`;

  const response = await fetchGraphQL("Round", query, { id: roundId });
  return response;
};

const fetchCompetitionRounds = async (id: string) => {
  const query = `
    query Competition($id: ID!) {
          competition(id: $id) {
              competitionEvents {
                  event {
                      id
                  }
                  rounds {
                      id
                      number
                  }
              }
          }
      }
  `;

  try {
    const response = (await fetchGraphQL("Competition", query, {
      id,
    })) as WCALiveCompetitionData;

    if ("data" in response && response.data?.competition) {
      return response.data.competition;
    } else if ("errors" in response && response.errors) {
      const errorDetail = response.errors.detail || "Unknown GraphQL error";
      throw new Error(`GraphQL query 'Competition' failed: ${errorDetail}`);
    } else {
      throw new Error("GraphQL query 'Competition' returned an unexpected response structure.");
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Fetch competition rounds error: ${error.message}`, {
        cause: error,
      });
    }
    throw new TypeError(
      `An unknown error occurred while fetching competition rounds: ${String(error)}`,
      { cause: error },
    );
  }
};

const getWCALiveID = async (competitionId: string) => {
  const linkUrl = `${WCA_LIVE_ENDPOINT}/link/competitions/${competitionId}`;
  const response = await fetch(linkUrl, {
    method: "GET",
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch WCA Live link for ${competitionId} from ${linkUrl}: ${response.status} ${response.statusText}`,
    );
  }

  const match = /\/competitions\/(?<id>[^/]+)/u.exec(response.url);

  if (!match) {
    throw new Error(
      `Unable to extract WCA Live ID from redirected URL: ${response.url} (original competition ID: ${competitionId})`,
    );
  }

  const [, wcaLiveID] = match;
  if (!wcaLiveID) {
    throw new Error(
      `Unable to extract WCA Live ID from redirected URL: ${response.url} (original competition ID: ${competitionId})`,
    );
  }
  return wcaLiveID;
};

const fetchGraphQL = async (operationName: string, query: string, variables: object) => {
  const requestOptions = {
    body: JSON.stringify({ operationName, query, variables }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  };

  const response = await fetch(WCA_LIVE_API_ENDPOINT, requestOptions);
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `GraphQL request failed with status ${response.status} ${response.statusText}: ${errorBody}`,
    );
  }
  return response.json();
};

export default fetchWCALiveResults;
