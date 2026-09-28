import makeRules, { type Rule } from "./make-rules";
import removeProtocol from "./remove-protocol";

export interface CompiledRule extends Rule {
  patterns: RegExp[];
}

const expandPath = (path: string) => {
  const expanded = [path];
  if (!["*.", "www."].find((prefix) => path.startsWith(prefix))) {
    expanded.push(`www.${path}`);
  }

  [...expanded].forEach((path) => {
    if (!path.includes("/")) {
      expanded.push(`${path}/*`);
    }
  });

  return expanded;
};

export const compileRules = (blocked: string[]): CompiledRule[] =>
  makeRules(blocked).map((rule) => ({
    ...rule,
    patterns: expandPath(rule.path)
      .map((path) => path.replace(/[.+]/g, "\\$&")) // escape regex characters
      .map(
        (path) =>
          "^" +
          path
            .replace(/\?/g, ".") // user can type "?" to match any one character
            .replace(/\*/g, ".*") + // user can type "*" to match any zero or more characters
          "$",
      )
      .map((pattern) => new RegExp(pattern)),
  }));

export const findCompiledRule = (url: string, rules: CompiledRule[]) => {
  const normalizedUrl = removeProtocol(url);
  return rules.find(({ patterns }) => patterns.some((pattern) => normalizedUrl.match(pattern)));
};

export default (url: string, blocked: string[]): Rule | undefined => {
  const foundRule = findCompiledRule(url, compileRules(blocked));
  if (!foundRule) return undefined;

  return foundRule.schedule === undefined
    ? { type: foundRule.type, path: foundRule.path }
    : { type: foundRule.type, path: foundRule.path, schedule: foundRule.schedule };
};
