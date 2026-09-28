import initStorage from "./storage/init";
import storage, { VALIDATORS } from "./storage";
import recreateContextMenu from "./helpers/recreate-context-menu";
import blockUrl from "./helpers/block-url";
import { compileRules, type CompiledRule } from "./helpers/find-rule";
import {
  isParsedScheduleActive,
  parseSchedule,
  type ScheduleRule,
} from "./helpers/is-schedule-active";
import { createPasscode, verifyPasscode } from "./helpers/passcode";
import {
  PROTECTED_SETTING_KEYS,
  ProtectedSettingsController,
  type ProtectedSettingKey,
} from "./helpers/protected-settings";
import type {
  SettingsMessage,
  SettingsMessageResponse,
} from "./helpers/settings-messages";

let __enabled = false;
let __contextMenu = false;
let __blocked: string[] = [];
let __rules: CompiledRule[] = [];
let __schedule: ScheduleRule[] = [];
let __settingsController: ProtectedSettingsController;

const handleContextMenuBlock = async (blockedUrl: string, tabId: number, url: string) => {
  const settings = __settingsController.getSettings();
  const blocked = await __settingsController.addBlockedRule(blockedUrl);
  if (!blocked) return;

  if (isParsedScheduleActive(parseSchedule(settings.schedule))) {
    blockUrl({ blocked, tabId, url });
  }
};

const syncProtectedSettings = (refreshContextMenu = false) => {
  const settings = __settingsController.getSettings();
  __enabled = settings.enabled;
  __contextMenu = settings.contextMenu;
  __blocked = settings.blocked;
  __rules = compileRules(settings.blocked);
  __schedule = parseSchedule(settings.schedule);
  if (refreshContextMenu) {
    recreateContextMenu(__enabled && __contextMenu, (blockedUrl, tabId, url) => {
      void handleContextMenuBlock(blockedUrl, tabId, url);
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
      const protectedChange = [...PROTECTED_SETTING_KEYS, "passcode"]
        .some((key) => changes[key] !== undefined);
      if (!protectedChange) return;

      const refreshContextMenu = Boolean(changes.enabled || changes.contextMenu);
      void __settingsController.restoreUnauthorizedChanges(changes)
        .then(() => syncProtectedSettings(refreshContextMenu));
    });
  });

const isSettingsMessage = (message: unknown): message is SettingsMessage => (
  message !== null
  && typeof message === "object"
  && "type" in message
  && typeof (message as { type?: unknown }).type === "string"
);

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
      message.type === "SET_PROTECTED_SETTING"
      && PROTECTED_SETTING_KEYS.includes(message.key)
      && VALIDATORS[message.key](message.value)
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

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (!__enabled || !__blocked.length) {
    return;
  }

  const { tabId, url, frameId } = details;
  if (!url || !url.startsWith("http") || frameId !== 0) {
    return;
  }

  blockUrl({ blocked: __blocked, rules: __rules, schedule: __schedule, tabId, url });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!tabId || !__enabled || !__blocked.length) {
    return;
  }

  const { url } = changeInfo;
  if (!url || !url.startsWith("http")) {
    return;
  }

  blockUrl({ blocked: __blocked, rules: __rules, schedule: __schedule, tabId, url });
});
