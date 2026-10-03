import isScheduleActive, {
  getNextScheduleBoundary,
  hasInvalidScheduleRules,
  isParsedScheduleActive,
  isScheduleLineInvalid,
  parseSchedule,
} from "../is-schedule-active";

describe("parseSchedule()", () => {
  it("parses all-day, block and allow rules", () => {
    expect(
      parseSchedule(`
      * # Block all day
      8-12 # Morning
      !14:30-16:00 # Break
      # 18-20 # Disabled
    `),
    ).toEqual([
      { type: "block-all" },
      { type: "block", start: 480, end: 720 },
      { type: "allow", start: 870, end: 960 },
    ]);
  });

  it("accepts hours, full times and mixed formats between 00:00 and 23:59", () => {
    expect(parseSchedule("0-23\n08:30-23:59\n8-12:30\n08:30-12")).toEqual([
      { type: "block", start: 0, end: 1380 },
      { type: "block", start: 510, end: 1439 },
      { type: "block", start: 480, end: 750 },
      { type: "block", start: 510, end: 720 },
    ]);
  });

  it("ignores invalid rules", () => {
    expect(parseSchedule("banana\n24-8\n0-24\n8->12\n8→12\n8-8")).toEqual([]);
  });
});

describe("hasInvalidScheduleRules()", () => {
  it("detects invalid active lines", () => {
    expect(hasInvalidScheduleRules("8-12\n# disabled\n!14:30-16")).toBe(false);
    expect(hasInvalidScheduleRules("8-12\n8→12")).toBe(true);
  });

  it("identifies only the invalid line", () => {
    expect(isScheduleLineInvalid("8-12 # valid")).toBe(false);
    expect(isScheduleLineInvalid("9-122 # invalid")).toBe(true);
    expect(isScheduleLineInvalid("# 9-122 # disabled")).toBe(false);
  });
});

describe("isScheduleActive()", () => {
  it("keeps the existing always-on behavior without rules", () => {
    expect(isScheduleActive("", new Date("2026-09-24T12:00:00Z"))).toBe(true);
  });

  it("matches regular and overnight block ranges", () => {
    expect(isScheduleActive("09:00-17:30", new Date("2026-09-24T12:00:00Z"))).toBe(true);
    expect(isScheduleActive("09:00-17:30", new Date("2026-09-24T17:30:00Z"))).toBe(false);
    expect(isScheduleActive("22-7", new Date("2026-09-24T23:00:00Z"))).toBe(true);
    expect(isScheduleActive("22-7", new Date("2026-09-24T06:59:00Z"))).toBe(true);
  });

  it("lets allow rules override block rules", () => {
    const rules = "*\n!8-12";

    expect(isScheduleActive(rules, new Date("2026-09-24T10:00:00Z"))).toBe(false);
    expect(isScheduleActive(rules, new Date("2026-09-24T14:00:00Z"))).toBe(true);
  });

  it("ignores rule order", () => {
    const now = new Date("2026-09-24T10:00:00Z");

    expect(isScheduleActive("*\n!8-12", now)).toBe(false);
    expect(isScheduleActive("!8-12\n*", now)).toBe(false);
    expect(isParsedScheduleActive(parseSchedule("*\n!8-12"), now)).toBe(false);
  });

  it("stays active when the source contains no valid rules", () => {
    expect(isScheduleActive("# *", new Date("2026-09-24T12:00:00Z"))).toBe(true);
    expect(isScheduleActive("banana", new Date("2026-09-24T12:00:00Z"))).toBe(true);
  });
});

describe("getNextScheduleBoundary()", () => {
  it("returns undefined without time ranges", () => {
    const now = new Date("2026-09-24T12:00:00Z");

    expect(getNextScheduleBoundary([], now)).toBeUndefined();
    expect(getNextScheduleBoundary([parseSchedule("*")], now)).toBeUndefined();
  });

  it("returns the closest start or end across all schedules", () => {
    const now = new Date("2026-09-24T10:30:45Z");

    expect(getNextScheduleBoundary([parseSchedule("8-12")], now)).toBe(
      Date.parse("2026-09-24T12:00:00Z"),
    );
    expect(getNextScheduleBoundary([parseSchedule("8-12"), parseSchedule("!11-11:15")], now)).toBe(
      Date.parse("2026-09-24T11:00:00Z"),
    );
  });

  it("wraps to the next day", () => {
    expect(getNextScheduleBoundary([parseSchedule("8-12")], new Date("2026-09-24T13:00:00Z"))).toBe(
      Date.parse("2026-09-25T08:00:00Z"),
    );
  });

  it("skips a boundary equal to the current minute", () => {
    expect(getNextScheduleBoundary([parseSchedule("8-12")], new Date("2026-09-24T08:00:00Z"))).toBe(
      Date.parse("2026-09-24T12:00:00Z"),
    );
  });
});
