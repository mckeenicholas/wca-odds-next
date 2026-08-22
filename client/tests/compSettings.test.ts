import { describe, it, expect, beforeEach } from "bun:test";
import { compSettingsStore } from "../src/lib/stores/compSettings";

describe("compSettingsStore", () => {
  beforeEach(() => {
    compSettingsStore.reset();
  });

  it("initializes with default values", () => {
    expect(compSettingsStore.compId()).toBeUndefined();
    expect(compSettingsStore.selectedEventId()).toBe("333");
    expect(compSettingsStore.includeDnf()).toBe(true);
    expect(compSettingsStore.decayHalfLife()).toBe(180);
    expect(compSettingsStore.startDate()).toBeInstanceOf(Date);
    expect(compSettingsStore.endDate()).toBeInstanceOf(Date);
    expect(compSettingsStore.competitorsByEvent()).toEqual({});
  });

  it("updates and retrieves competition ID", () => {
    compSettingsStore.setCompId("USNationals2025");
    expect(compSettingsStore.compId()).toBe("USNationals2025");

    compSettingsStore.setCompId(undefined);
    expect(compSettingsStore.compId()).toBeUndefined();
  });

  it("updates selected event ID", () => {
    compSettingsStore.setSelectedEventId("444");
    expect(compSettingsStore.selectedEventId()).toBe("444");
  });

  it("updates includeDnf and decayHalfLife", () => {
    compSettingsStore.setIncludeDnf(false);
    expect(compSettingsStore.includeDnf()).toBe(false);

    compSettingsStore.setDecayHalfLife(90);
    expect(compSettingsStore.decayHalfLife()).toBe(90);
  });

  it("updates start and end dates", () => {
    const start = new Date(2024, 0, 1);
    const end = new Date(2025, 0, 1);

    compSettingsStore.setStartDate(start);
    compSettingsStore.setEndDate(end);

    expect(compSettingsStore.startDate()).toEqual(start);
    expect(compSettingsStore.endDate()).toEqual(end);
  });

  it("updates competitors by event map", () => {
    const competitors = [
      {
        id: "2015MCKE02",
        name: "Nicholas McKee",
        country: "Canada",
        rank: 1,
        selected: true,
      },
    ];
    compSettingsStore.setCompetitorsByEvent({ "333": competitors });
    expect(compSettingsStore.competitorsByEvent()).toEqual({ "333": competitors });
  });

  it("resets back to default state", () => {
    compSettingsStore.setCompId("TempComp");
    compSettingsStore.setSelectedEventId("555");
    compSettingsStore.setDecayHalfLife(45);
    compSettingsStore.setIncludeDnf(false);

    compSettingsStore.reset();

    expect(compSettingsStore.compId()).toBeUndefined();
    expect(compSettingsStore.selectedEventId()).toBe("333");
    expect(compSettingsStore.decayHalfLife()).toBe(180);
    expect(compSettingsStore.includeDnf()).toBe(true);
  });
});
