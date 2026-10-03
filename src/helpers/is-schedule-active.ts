export type ScheduleRule = {
  type: "block" | "allow" | "block-all";
  start?: number;
  end?: number;
};

const parseTime = (hours: string, minutes = "0") => {
  const parsedHours = Number(hours);
  const parsedMinutes = Number(minutes);

  if (parsedHours > 23 || parsedMinutes > 59) {
    return undefined;
  }

  return parsedHours * 60 + parsedMinutes;
};

const parseRange = (value: string): Omit<ScheduleRule, "type"> | undefined => {
  const match = value.match(/^(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?$/);
  if (!match) {
    return undefined;
  }

  const start = parseTime(match[1], match[2]);
  const end = parseTime(match[3], match[4]);
  if (start === undefined || end === undefined || start === end) {
    return undefined;
  }

  return { start, end };
};

export const parseSchedule = (source: string): ScheduleRule[] =>
  source.split("\n").flatMap((rawLine): ScheduleRule[] => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      return [];
    }

    const value = line.split("#", 1)[0].trim();
    if (value === "*") {
      return [{ type: "block-all" }];
    }

    const type = value.startsWith("!") ? "allow" : "block";
    const range = parseRange(type === "allow" ? value.slice(1).trim() : value);
    return range ? [{ type, ...range }] : [];
  });

export const isScheduleLineInvalid = (rawLine: string) => {
  const line = rawLine.trim();
  return Boolean(line && !line.startsWith("#") && parseSchedule(line).length === 0);
};

export const hasInvalidScheduleRules = (source: string) =>
  source.split("\n").some(isScheduleLineInvalid);

const contains = ({ start, end }: ScheduleRule, currentTime: number) => {
  if (start === undefined || end === undefined) {
    return false;
  }

  if (start < end) {
    return currentTime >= start && currentTime < end;
  }

  return currentTime >= start || currentTime < end;
};

export const isParsedScheduleActive = (rules: ScheduleRule[], now = new Date()) => {
  if (!rules.length) {
    return true;
  }

  const currentTime = now.getHours() * 60 + now.getMinutes();
  const isAllowed = rules.some((rule) => rule.type === "allow" && contains(rule, currentTime));
  const isBlocked = rules.some(
    (rule) => rule.type === "block-all" || (rule.type === "block" && contains(rule, currentTime)),
  );

  return isBlocked && !isAllowed;
};

const MINUTES_PER_DAY = 24 * 60;

export const getNextScheduleBoundary = (schedules: ScheduleRule[][], now = new Date()) => {
  const boundaries = new Set<number>();
  for (const { start, end } of schedules.flat()) {
    if (start !== undefined) boundaries.add(start);
    if (end !== undefined) boundaries.add(end);
  }

  if (!boundaries.size) {
    return undefined;
  }

  const currentTime = now.getHours() * 60 + now.getMinutes();
  const minutesUntilNext = Math.min(
    ...[...boundaries].map(
      (boundary) => (boundary - currentTime + MINUTES_PER_DAY) % MINUTES_PER_DAY || MINUTES_PER_DAY,
    ),
  );

  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + minutesUntilNext);
  return next.getTime();
};

export default (source: string, now = new Date()) =>
  isParsedScheduleActive(parseSchedule(source), now);
