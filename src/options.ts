import { hasInvalidScheduleRules, isScheduleLineInvalid } from "./helpers/is-schedule-active";
import { hasInvalidSiteRules, isSiteRuleLineInvalid } from "./helpers/make-rules";
import type { PasscodeLockState, ProtectedSettingKey } from "./helpers/protected-settings";
import { sendSettingsMessage } from "./helpers/settings-messages";
import storage, {
  BLOCKED_EXAMPLE,
  type CounterPeriod,
  RESOLUTIONS,
  type Resolution,
  SCHEDULE_EXAMPLE,
  type Schema,
} from "./storage";

const UI = (() => {
  const elements = {
    enabled: document.getElementById("enabled") as HTMLSelectElement,
    contextMenu: document.getElementById("context-menu") as HTMLSelectElement,
    blockedList: document.getElementById("blocked-list") as HTMLTextAreaElement,
    blockedHighlight: document.querySelector("#blocked-highlight code") as HTMLElement,
    scheduleRules: document.getElementById("schedule-rules") as HTMLTextAreaElement,
    scheduleHighlight: document.querySelector("#schedule-highlight code") as HTMLElement,
    blockedContainer: document.getElementById("blocked-container") as HTMLDivElement,
    schedulesContainer: document.getElementById("schedules-container") as HTMLDivElement,
    contentTabs: document.querySelectorAll<HTMLButtonElement>(".content-tab"),
    resolution: document.getElementById("resolution") as HTMLSelectElement,
    counterShow: document.getElementById("counter-show") as HTMLSelectElement,
    counterPeriod: document.getElementById("counter-period") as HTMLSelectElement,
    settingsLock: document.getElementById("passcode-button") as HTMLButtonElement,
    passcodeDialog: document.getElementById("passcode-dialog") as HTMLDialogElement,
    passcodeInputs: Array.from(
      document.querySelectorAll<HTMLInputElement>("#passcode-inputs input"),
    ),
    passcodePrompt: document.getElementById("passcode-prompt") as HTMLParagraphElement,
    passcodeError: document.getElementById("passcode-error") as HTMLParagraphElement,
    passcodeClose: document.getElementById("passcode-close") as HTMLButtonElement,
  };

  const editableElements: (HTMLSelectElement | HTMLTextAreaElement)[] = [
    elements.enabled,
    elements.contextMenu,
    elements.blockedList,
    elements.scheduleRules,
  ];
  let passcode: PasscodeLockState = {
    hasPasscode: false,
    failedAttempts: 0,
    lockedUntil: 0,
  };
  let passcodeMode: "setup" | "unlock" = "setup";
  let setupPasscode = "";
  let setupStep = 1;
  let retryTimer: number | undefined;
  let checkingPasscode = false;

  elements.blockedList.placeholder = BLOCKED_EXAMPLE.join("\n");
  elements.scheduleRules.placeholder = SCHEDULE_EXAMPLE.join("\n");

  const booleanToString = (b: boolean) => (b ? "YES" : "NO");
  const stringToBoolean = (s: string) => s === "YES";
  const isSettingsLocked = () => passcode.hasPasscode;

  const setProtectedSetting = <K extends ProtectedSettingKey>(key: K, value: Schema[K]) => {
    void sendSettingsMessage({
      type: "SET_PROTECTED_SETTING",
      key,
      value,
    });
  };

  const renderLockState = () => {
    const locked = isSettingsLocked();
    document.body.classList.toggle("settings-locked", locked);
    editableElements.forEach((element) => {
      element.disabled = locked;
    });
    const action = locked ? "Unlock settings" : "Set passcode";
    elements.settingsLock.setAttribute("aria-label", action);
    elements.settingsLock.title = action;
  };

  const setPasscodeInputsDisabled = (disabled: boolean) => {
    elements.passcodeInputs.forEach((input) => {
      input.disabled = disabled;
    });
  };

  const clearPasscodeInputs = () => {
    elements.passcodeInputs.forEach((input) => {
      input.value = "";
    });
    if (!elements.passcodeInputs[0].disabled) {
      elements.passcodeInputs[0].focus();
    }
  };

  const formatRetryTime = (milliseconds: number) => {
    const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  };

  const showFailedAttempts = () => {
    window.clearInterval(retryTimer);
    const update = () => {
      const remaining = Math.max(0, passcode.lockedUntil - Date.now());
      setPasscodeInputsDisabled(remaining > 0 || checkingPasscode);
      if (remaining > 0) {
        elements.passcodeError.textContent = `${passcode.failedAttempts} failed attempts. Try again in ${formatRetryTime(remaining)}.`;
        return;
      }

      window.clearInterval(retryTimer);
      elements.passcodeError.textContent = passcode.failedAttempts
        ? `${passcode.failedAttempts} failed attempt${passcode.failedAttempts === 1 ? "" : "s"}.`
        : "";
      clearPasscodeInputs();
    };

    update();
    if (passcode.lockedUntil > Date.now()) {
      retryTimer = window.setInterval(update, 250);
    }
  };

  const closePasscodeDialog = () => {
    window.clearInterval(retryTimer);
    elements.passcodeDialog.close();
  };

  const openPasscodeDialog = () => {
    passcodeMode = isSettingsLocked() ? "unlock" : "setup";
    setupStep = 1;
    setupPasscode = "";
    elements.passcodePrompt.textContent =
      passcodeMode === "unlock" ? "Enter Screen Time passcode" : "Enter new Screen Time passcode";
    elements.passcodeError.textContent = "";
    elements.passcodeDialog.showModal();
    setPasscodeInputsDisabled(false);
    clearPasscodeInputs();
    if (passcodeMode === "unlock") {
      showFailedAttempts();
    }
  };

  const getEventTargetValue = (event: Event) =>
    (event.target as HTMLTextAreaElement | HTMLSelectElement).value;
  const stringToBlocked = (string: string) =>
    string
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  const updateEditorValidity = (
    value: string,
    textarea: HTMLTextAreaElement,
    highlight: HTMLElement,
    hasInvalidRules: (source: string) => boolean,
    isLineInvalid: (line: string) => boolean,
  ) => {
    textarea.setAttribute("aria-invalid", String(hasInvalidRules(value)));
    const lines = value.split("\n");
    const fragments = lines.flatMap((line, index) => {
      const span = document.createElement("span");
      span.classList.toggle("invalid", isLineInvalid(line));
      span.textContent = line;
      return index < lines.length - 1 ? [span, document.createTextNode("\n")] : [span];
    });
    highlight.replaceChildren(...fragments);
  };
  const updateBlockedValidity = (value: string) => {
    updateEditorValidity(
      value,
      elements.blockedList,
      elements.blockedHighlight,
      hasInvalidSiteRules,
      isSiteRuleLineInvalid,
    );
  };
  const updateScheduleValidity = (value: string) => {
    updateEditorValidity(
      value,
      elements.scheduleRules,
      elements.scheduleHighlight,
      hasInvalidScheduleRules,
      isScheduleLineInvalid,
    );
  };
  const syncEditorScroll = (textarea: HTMLTextAreaElement, highlight: HTMLElement) => {
    highlight.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`;
  };

  const showContent = (content: string) => {
    elements.contentTabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.content === content);
    });
    elements.blockedContainer.hidden = content !== "blocked";
    elements.schedulesContainer.hidden = content !== "schedules";
  };

  elements.contentTabs.forEach((tab) => {
    tab.addEventListener("click", () => showContent(tab.dataset.content || "blocked"));
  });

  elements.enabled.addEventListener("change", (event) => {
    if (isSettingsLocked()) return;
    const enabled = stringToBoolean(getEventTargetValue(event));
    setProtectedSetting("enabled", enabled);
  });

  elements.contextMenu.addEventListener("change", (event) => {
    if (isSettingsLocked()) return;
    const contextMenu = stringToBoolean(getEventTargetValue(event));
    setProtectedSetting("contextMenu", contextMenu);
  });

  elements.blockedList.addEventListener("input", (event) => {
    if (isSettingsLocked()) return;
    const value = getEventTargetValue(event);
    const blocked = stringToBlocked(value);
    updateBlockedValidity(value);
    setProtectedSetting("blocked", blocked);
  });
  elements.blockedList.addEventListener("scroll", () => {
    syncEditorScroll(elements.blockedList, elements.blockedHighlight);
  });

  elements.scheduleRules.addEventListener("input", (event) => {
    if (isSettingsLocked()) return;
    const schedule = getEventTargetValue(event);
    updateScheduleValidity(schedule);
    setProtectedSetting("schedule", schedule);
  });
  elements.scheduleRules.addEventListener("scroll", () => {
    syncEditorScroll(elements.scheduleRules, elements.scheduleHighlight);
  });

  elements.resolution.addEventListener("change", (event) => {
    const resolution = getEventTargetValue(event) as Resolution;
    storage.set({ resolution });
  });

  elements.counterShow.addEventListener("change", (event) => {
    const counterShow = stringToBoolean(getEventTargetValue(event));
    storage.set({ counterShow });
  });

  elements.counterPeriod.addEventListener("change", (event) => {
    const counterPeriod = getEventTargetValue(event) as CounterPeriod;
    storage.set({ counterPeriod });
  });

  const init = <T extends Partial<Schema>>(items: T) => {
    if (items.enabled !== undefined) {
      elements.enabled.value = booleanToString(items.enabled);
    }

    if (items.contextMenu !== undefined) {
      elements.contextMenu.value = booleanToString(items.contextMenu);
    }

    if (items.blocked !== undefined) {
      const valueAsBlocked = stringToBlocked(elements.blockedList.value);
      if (JSON.stringify(valueAsBlocked) !== JSON.stringify(items.blocked)) {
        elements.blockedList.value = items.blocked.join("\r\n");
      }
      updateBlockedValidity(elements.blockedList.value);
    }

    if (
      items.schedule !== undefined &&
      document.activeElement !== elements.scheduleRules &&
      elements.scheduleRules.value !== items.schedule
    ) {
      elements.scheduleRules.value = items.schedule;
    }
    if (items.schedule !== undefined) {
      updateScheduleValidity(items.schedule);
    }

    if (items.resolution !== undefined) {
      elements.resolution.value = items.resolution;
      RESOLUTIONS.forEach((oneResolution) => {
        document.body.classList.remove(`resolution-${oneResolution}`);
      });
      document.body.classList.add(`resolution-${items.resolution}`);
    }

    if (items.counterShow !== undefined) {
      elements.counterShow.value = booleanToString(items.counterShow);
      document.body.classList.toggle("counter-show", items.counterShow);
    }

    if (items.counterPeriod !== undefined) {
      elements.counterPeriod.value = items.counterPeriod;
    }
  };

  const submitPasscode = async () => {
    if (checkingPasscode || passcode.lockedUntil > Date.now()) return;
    const value = elements.passcodeInputs.map((input) => input.value).join("");
    if (!/^\d{4}$/.test(value)) return;

    if (passcodeMode === "setup") {
      if (setupStep === 1) {
        setupPasscode = value;
        setupStep = 2;
        elements.passcodePrompt.textContent = "Re-enter new Screen Time passcode";
        elements.passcodeError.textContent = "";
        clearPasscodeInputs();
        return;
      }

      if (value !== setupPasscode) {
        setupStep = 1;
        setupPasscode = "";
        elements.passcodePrompt.textContent = "Enter new Screen Time passcode";
        elements.passcodeError.textContent = "Passcodes did not match.";
        clearPasscodeInputs();
        return;
      }

      checkingPasscode = true;
      setPasscodeInputsDisabled(true);
      const response = await sendSettingsMessage({ type: "SET_PASSCODE", passcode: value });
      passcode = response.lockState;
      setupPasscode = "";
      checkingPasscode = false;
      closePasscodeDialog();
      renderLockState();
      return;
    }

    checkingPasscode = true;
    setPasscodeInputsDisabled(true);
    const response = await sendSettingsMessage({ type: "UNLOCK_SETTINGS", passcode: value });
    checkingPasscode = false;
    passcode = response.lockState;
    if (response.success) {
      closePasscodeDialog();
      renderLockState();
      return;
    }

    clearPasscodeInputs();
    showFailedAttempts();
  };

  elements.passcodeInputs.forEach((input, index) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(-1);
      if (input.value && index < elements.passcodeInputs.length - 1) {
        elements.passcodeInputs[index + 1].focus();
      }
      void submitPasscode();
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Backspace" && !input.value && index > 0) {
        elements.passcodeInputs[index - 1].focus();
      }
    });

    input.addEventListener("paste", (event) => {
      event.preventDefault();
      const digits = event.clipboardData?.getData("text").replace(/\D/g, "").slice(0, 4) || "";
      digits.split("").forEach((digit, digitIndex) => {
        elements.passcodeInputs[digitIndex].value = digit;
      });
      elements.passcodeInputs[Math.min(digits.length, 3)].focus();
      void submitPasscode();
    });
  });

  elements.settingsLock.addEventListener("click", openPasscodeDialog);
  elements.passcodeClose.addEventListener("click", closePasscodeDialog);
  elements.passcodeDialog.addEventListener("close", () => {
    window.clearInterval(retryTimer);
    checkingPasscode = false;
    setupPasscode = "";
    elements.passcodeInputs.forEach((input) => {
      input.value = "";
    });
  });

  const setLockState = (state: PasscodeLockState) => {
    passcode = state;
    renderLockState();
  };

  return { elements, init, setLockState };
})();

window.addEventListener("DOMContentLoaded", () => {
  const keys: (keyof Schema)[] = [
    "enabled",
    "contextMenu",
    "blocked",
    "resolution",
    "counterShow",
    "counterPeriod",
    "schedule",
  ];

  Promise.all([storage.get(keys), sendSettingsMessage({ type: "GET_LOCK_STATE" })]).then(
    ([local, response]) => {
      UI.setLockState(response.lockState);
      UI.init(local);
      document.body.classList.add("ready");
    },
  );

  chrome.storage.local.onChanged.addListener((changes) => {
    keys.forEach((key) => {
      if (changes[key]) {
        UI.init({ [key]: changes[key].newValue });
      }
    });
    if (changes.passcode) {
      void sendSettingsMessage({ type: "GET_LOCK_STATE" }).then((response) => {
        UI.setLockState(response.lockState);
      });
    }
  });
});
