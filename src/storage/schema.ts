import { createEmptyPasscode, type PasscodeState } from "../helpers/passcode";

export const RESOLUTIONS = ["CLOSE_TAB", "SHOW_BLOCKED_INFO_PAGE"] as const;

export const COUNTER_PERIODS = ["ALL_TIME", "THIS_MONTH", "THIS_WEEK", "TODAY"] as const;

export type Resolution = (typeof RESOLUTIONS)[number];
export type CounterPeriod = (typeof COUNTER_PERIODS)[number];

export interface Schema {
  enabled: boolean;
  contextMenu: boolean;
  blocked: string[];
  counter: Record<string, number[]>;
  counterShow: boolean;
  counterPeriod: CounterPeriod;
  resolution: Resolution;
  schedule: string;
  passcode: PasscodeState;
  youtubeDistractionsPausedUntil: number;
}

export const DEFAULTS: Readonly<Schema> = {
  enabled: false,
  contextMenu: false,
  blocked: [],
  counter: {},
  counterShow: false,
  counterPeriod: "ALL_TIME",
  resolution: "CLOSE_TAB",
  schedule: "",
  passcode: createEmptyPasscode(),
  youtubeDistractionsPausedUntil: 0,
};

export const VALIDATORS: Readonly<Record<keyof Schema, (value: unknown) => boolean>> = {
  enabled: (value) => typeof value === "boolean",
  contextMenu: (value) => typeof value === "boolean",
  blocked: (value) => Array.isArray(value) && value.every((item) => typeof item === "string"),
  counter: (value) => typeof value === "object",
  counterShow: (value) => typeof value === "boolean",
  counterPeriod: (value) => COUNTER_PERIODS.includes(value as CounterPeriod),
  resolution: (value) => RESOLUTIONS.includes(value as Resolution),
  schedule: (value) => typeof value === "string",
  youtubeDistractionsPausedUntil: (value) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0,
  passcode: (value) => {
    if (!value || typeof value !== "object") return false;
    const passcode = value as PasscodeState;
    return (
      typeof passcode.hash === "string" &&
      typeof passcode.salt === "string" &&
      Number.isInteger(passcode.failedAttempts) &&
      passcode.failedAttempts >= 0 &&
      Number.isFinite(passcode.lockedUntil) &&
      passcode.lockedUntil >= 0
    );
  },
};

export const SCHEDULE_EXAMPLE = [
  "*                  # block all day",
  "",

  "8-12               # block during this time",
  "!08:15-12:30       # ! = don't block during this time",
  "22:00-07:00        # crosses midnight",
  "",

  "# 14:15-15:30      # # = disabled rule",
];

export const BLOCKED_EXAMPLE: string[] = [
  "example.com          # any page (same as example.com/*)",
  "example.com/         # main page only",
  "example.com/*        # any page",
  "",

  "!one.example.com     # ! = exclude",
  "*.example.com        # * = any zero or more characters",
  "example.com/???/     # ? = any one character",
  "",

  "example.com | 7-18                # override global schedule",
  "example.com | *, !12:00-13:00     # other domain's custom schedule",
];
