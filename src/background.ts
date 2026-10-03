import blockUrl from "./helpers/block-url";
import { type CompiledRule, compileRules } from "./helpers/find-rule";
import {
  getNextScheduleBoundary,
  parseSchedule,
  type ScheduleRule,
} from "./helpers/is-schedule-active";
import { createPasscode, verifyPasscode } from "./helpers/passcode";
import {
  PROTECTED_SETTING_KEYS,
  type ProtectedSettingKey,
  ProtectedSettingsController,
} from "./helpers/protected-settings";
import recreateContextMenu from "./helpers/recreate-context-menu";
import type { SettingsMessage, SettingsMessageResponse } from "./helpers/settings-messages";
import storage, { VALIDATORS } from "./storage";
import initStorage from "./storage/init";

let __enabled = false;
let __contextMenu = false;
let __blocked: string[] = [];
let __rules: CompiledRule[] = [];
let __schedule: ScheduleRule[] = [];
let __settingsController: ProtectedSettingsController;

const SCHEDULE_BOUNDARY_ALARM = "schedule-boundary";
const SCHEDULE_SAFETY_ALARM = "schedule-safety";

const enforceOpenTabs = async () => {
  if (!__enabled || !__blocked.length) return;

  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const { id, url } of tabs) {
    if (!id || !url) continue;
    blockUrl({
      blocked: __blocked,
      rules: __rules,
      schedule: __schedule,
      tabId: id,
      url,
      countAttempt: false,
    });
  }
};

// Already-open tabs fire no navigation event when a schedule range starts.
const scheduleEnforcement = async () => {
  const nextBoundary =
    __enabled && __blocked.length
      ? getNextScheduleBoundary([__schedule, ...__rules.map((rule) => rule.schedule ?? [])])
      : undefined;

  if (nextBoundary === undefined) {
    await chrome.alarms.clearAll();
    return;
  }

  await chrome.alarms.create(SCHEDULE_BOUNDARY_ALARM, { when: nextBoundary });
  if (!(await chrome.alarms.get(SCHEDULE_SAFETY_ALARM))) {
    await chrome.alarms.create(SCHEDULE_SAFETY_ALARM, { periodInMinutes: 1 });
  }
};

const syncProtectedSettings = (refreshContextMenu = false) => {
  const settings = __settingsController.getSettings();
  __enabled = settings.enabled;
  __contextMenu = settings.contextMenu;
  __blocked = settings.blocked;
  __rules = compileRules(settings.blocked);
  __schedule = parseSchedule(settings.schedule);
  void scheduleEnforcement();
  if (refreshContextMenu) {
    recreateContextMenu(__enabled && __contextMenu, (blockedUrl) => {
      void __settingsController.addBlockedRule(blockedUrl);
    });
  }
};

const controllerReady = initStorage()
  .then(() => storage.get(["enabled", "contextMenu", "blocked", "schedule", "passcode"]))
  .then((settings) => {
    __settingsController = new ProtectedSettingsController(
      settings,
      (updates) => storage.set(updates),
      createPasscode,
      verifyPasscode,
    );
    syncProtectedSettings(true);

    chrome.storage.local.onChanged.addListener((changes) => {
      const protectedChange = [...PROTECTED_SETTING_KEYS, "passcode"].some(
        (key) => changes[key] !== undefined,
      );
      if (!protectedChange) return;

      const refreshContextMenu = Boolean(changes.enabled || changes.contextMenu);
      const blockingChange = Boolean(changes.enabled || changes.blocked || changes.schedule);
      void __settingsController.restoreUnauthorizedChanges(changes).then(() => {
        syncProtectedSettings(refreshContextMenu);
        if (blockingChange) return enforceOpenTabs();
      });
    });
  });

const isSettingsMessage = (message: unknown): message is SettingsMessage =>
  message !== null &&
  typeof message === "object" &&
  "type" in message &&
  typeof (message as { type?: unknown }).type === "string";

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !isSettingsMessage(message)) return false;

  void controllerReady.then(async () => {
    let success = false;
    if (message.type === "GET_LOCK_STATE") {
      success = true;
    } else if (message.type === "SET_PASSCODE" && /^\d{4}$/.test(message.passcode)) {
      success = await __settingsController.setPasscode(message.passcode);
    } else if (message.type === "UNLOCK_SETTINGS" && /^\d{4}$/.test(message.passcode)) {
      success = await __settingsController.unlock(message.passcode);
    } else if (
      message.type === "SET_PROTECTED_SETTING" &&
      PROTECTED_SETTING_KEYS.includes(message.key) &&
      VALIDATORS[message.key](message.value)
    ) {
      success = await __settingsController.setSetting(
        message.key as ProtectedSettingKey,
        message.value,
      );
    }

    sendResponse({
      success,
      lockState: __settingsController.getLockState(),
    } satisfies SettingsMessageResponse);
  });
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== SCHEDULE_BOUNDARY_ALARM && alarm.name !== SCHEDULE_SAFETY_ALARM) return;

  void controllerReady.then(async () => {
    await enforceOpenTabs();
    if (alarm.name === SCHEDULE_BOUNDARY_ALARM) await scheduleEnforcement();
  });
});

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (!__enabled || !__blocked.length) {
    return;
  }

  const { tabId, url, frameId } = details;
  if (!url?.startsWith("http") || frameId !== 0) {
    return;
  }

  blockUrl({ blocked: __blocked, rules: __rules, schedule: __schedule, tabId, url });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!tabId || !__enabled || !__blocked.length) {
    return;
  }

  const { url } = changeInfo;
  if (!url?.startsWith("http")) {
    return;
  }

  blockUrl({ blocked: __blocked, rules: __rules, schedule: __schedule, tabId, url });
});
