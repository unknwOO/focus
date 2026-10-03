import storage from "../storage";
import * as counterHelper from "./counter";
import findRule, { type CompiledRule, findCompiledRule } from "./find-rule";
import getBlockedUrl from "./get-blocked-url";
import { isParsedScheduleActive, type ScheduleRule } from "./is-schedule-active";

interface BlockUrlOptions {
  blocked: string[];
  rules?: CompiledRule[];
  schedule?: ScheduleRule[];
  tabId: number;
  url: string;
  countAttempt?: boolean;
}

export default (options: BlockUrlOptions) => {
  const { blocked, rules, schedule = [], tabId, url, countAttempt = true } = options;
  if (!blocked.length || !tabId || !url.startsWith("http")) {
    return;
  }

  const foundRule = rules ? findCompiledRule(url, rules) : findRule(url, blocked);
  if (!foundRule || foundRule.type === "allow") {
    return;
  }

  if (!isParsedScheduleActive(foundRule.schedule ?? schedule)) {
    return;
  }

  storage
    .get(["counter", "counterShow", "counterPeriod", "resolution"])
    .then(({ counter, counterShow, counterPeriod, resolution }) => {
      const timeStamp = Date.now();
      const countOptions = {
        counter,
        countFromTimeStamp: counterHelper.counterPeriodToTimeStamp(counterPeriod, timeStamp),
      };

      let count: number;
      if (countAttempt) {
        counterHelper.flushObsoleteEntries({ blocked, counter });
        count = counterHelper.add(foundRule.path, timeStamp, countOptions);
        storage.set({ counter });
      } else {
        count = counterHelper.count(foundRule.path, countOptions);
      }

      switch (resolution) {
        case "CLOSE_TAB":
          chrome.tabs.remove(tabId);
          break;
        case "SHOW_BLOCKED_INFO_PAGE": {
          const commonUpdateProperties = {
            url: getBlockedUrl({
              url,
              rule: foundRule.path,
              countParams: counterShow ? { count, period: counterPeriod } : undefined,
            }),
          };

          if (process.env.TARGET === "chrome") {
            chrome.tabs.update(tabId, commonUpdateProperties);
            break;
          }

          if (process.env.TARGET === "firefox") {
            browser.tabs.update(tabId, { ...commonUpdateProperties, loadReplace: true });
            break;
          }
        }
      }
    });
};
