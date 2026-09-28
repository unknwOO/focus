import type { Schema } from "../storage";
import { createEmptyPasscode, getPasscodeRetryDelay, type PasscodeState } from "./passcode";

export const PROTECTED_SETTING_KEYS = ["enabled", "contextMenu", "blocked", "schedule"] as const;

export type ProtectedSettingKey = (typeof PROTECTED_SETTING_KEYS)[number];
export type ProtectedSettings = Pick<Schema, ProtectedSettingKey | "passcode">;

export type PasscodeLockState = Pick<PasscodeState, "failedAttempts" | "lockedUntil"> & {
  hasPasscode: boolean;
};

type StorageChanges = Record<string, { newValue?: unknown }>;
type WriteSettings = (settings: Partial<ProtectedSettings>) => Promise<void>;
type CreatePasscode = (passcode: string) => Promise<PasscodeState>;
type VerifyPasscode = (passcode: string, state: PasscodeState) => Promise<boolean>;

const hasPasscode = (state: PasscodeState) => Boolean(state.hash && state.salt);
const valuesMatch = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

export class ProtectedSettingsController {
  private settings: ProtectedSettings;
  private operationQueue: Promise<void> = Promise.resolve();

  public constructor(
    settings: ProtectedSettings,
    private readonly writeSettings: WriteSettings,
    private readonly createPasscode: CreatePasscode,
    private readonly verifyPasscode: VerifyPasscode,
    private readonly now: () => number = Date.now,
  ) {
    this.settings = structuredClone(settings);
  }

  public getLockState(): PasscodeLockState {
    return {
      hasPasscode: hasPasscode(this.settings.passcode),
      failedAttempts: this.settings.passcode.failedAttempts,
      lockedUntil: this.settings.passcode.lockedUntil,
    };
  }

  public getSettings() {
    return structuredClone(this.settings);
  }

  public async setSetting<K extends ProtectedSettingKey>(key: K, value: Schema[K]) {
    return this.runExclusive(async () => {
      if (hasPasscode(this.settings.passcode)) return false;

      const update: Partial<ProtectedSettings> = {};
      Object.assign(update, { [key]: value });
      await this.write(update);
      return true;
    });
  }

  public async addBlockedRule(rule: string) {
    return this.runExclusive(async () => {
      const normalizedRule = rule.trim();
      if (!normalizedRule || normalizedRule.startsWith("!")) return undefined;

      if (this.settings.blocked.includes(normalizedRule)) {
        return [...this.settings.blocked];
      }

      const blocked = [...this.settings.blocked, normalizedRule];
      await this.write({ blocked });
      return blocked;
    });
  }

  public async setPasscode(passcode: string) {
    return this.runExclusive(async () => {
      if (hasPasscode(this.settings.passcode) || !/^\d{4}$/.test(passcode)) return false;

      await this.write({ passcode: await this.createPasscode(passcode) });
      return true;
    });
  }

  public async unlock(passcode: string) {
    return this.runExclusive(async () => {
      if (!hasPasscode(this.settings.passcode)) return true;
      if (this.settings.passcode.lockedUntil > this.now()) return false;

      if (await this.verifyPasscode(passcode, this.settings.passcode)) {
        await this.write({ passcode: createEmptyPasscode() });
        return true;
      }

      const failedAttempts = this.settings.passcode.failedAttempts + 1;
      const delay = getPasscodeRetryDelay(failedAttempts);
      await this.write({
        passcode: {
          ...this.settings.passcode,
          failedAttempts,
          lockedUntil: delay ? this.now() + delay : 0,
        },
      });
      return false;
    });
  }

  public async restoreUnauthorizedChanges(changes: StorageChanges) {
    return this.runExclusive(async () => {
      const restore: Partial<ProtectedSettings> = {};
      const keys: (keyof ProtectedSettings)[] = [...PROTECTED_SETTING_KEYS, "passcode"];

      keys.forEach((key) => {
        const change = changes[key];
        if (change && !valuesMatch(change.newValue, this.settings[key])) {
          Object.assign(restore, { [key]: structuredClone(this.settings[key]) });
        }
      });

      if (Object.keys(restore).length) {
        await this.writeSettings(restore);
      }
    });
  }

  private async write(settings: Partial<ProtectedSettings>) {
    this.settings = { ...this.settings, ...structuredClone(settings) };
    await this.writeSettings(settings);
  }

  private runExclusive<T>(operation: () => Promise<T>) {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
