import { isScheduleLineInvalid, parseSchedule, type ScheduleRule } from "./is-schedule-active";
import removeProtocol from "./remove-protocol";

type RuleType = "allow" | "block";

export interface Rule {
  type: RuleType;
  path: string;
  schedule?: ScheduleRule[];
}

const splitItem = (item: string) => {
  const separatorIndex = item.indexOf("|");
  if (separatorIndex === -1) {
    return { path: item.trim() };
  }

  return {
    path: item.slice(0, separatorIndex).trim(),
    schedule: item.slice(separatorIndex + 1).trim(),
  };
};

const scheduleToLines = (schedule: string) => schedule.split(",").map((rule) => rule.trim());

export const isSiteRuleLineInvalid = (rawLine: string) => {
  const line = rawLine.trim();
  if (!line) return false;

  const item = splitItem(line);
  const path = item.path.startsWith("!") ? item.path.slice(1).trim() : item.path;
  if (!path) return true;
  if (item.schedule === undefined) return false;

  const scheduleLines = scheduleToLines(item.schedule);
  return scheduleLines.some((rule) => !rule || isScheduleLineInvalid(rule));
};

export const hasInvalidSiteRules = (source: string) =>
  source.split("\n").some(isSiteRuleLineInvalid);

const makeRule = (item: string, type: RuleType): Rule => {
  const parsed = splitItem(item);
  const rawPath = type === "allow" ? parsed.path.slice(1) : parsed.path;
  const rule: Rule = { type, path: removeProtocol(rawPath.trim()) };
  if (parsed.schedule !== undefined) {
    rule.schedule = parseSchedule(scheduleToLines(parsed.schedule).join("\n"));
  }
  return rule;
};

export default (blocked: string[]): Rule[] => {
  const allowList = blocked
    .filter((item) => item.startsWith("!"))
    .map((item) => makeRule(item, "allow"));

  const blockList = blocked
    .filter((item) => !item.startsWith("!"))
    .map((item) => makeRule(item, "block"));

  return [...allowList, ...blockList];
};
