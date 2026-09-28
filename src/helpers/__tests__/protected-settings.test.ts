import { createEmptyPasscode, type PasscodeState } from "../passcode";
import { type ProtectedSettings, ProtectedSettingsController } from "../protected-settings";

const lockedPasscode: PasscodeState = {
  hash: "hash",
  salt: "salt",
  failedAttempts: 0,
  lockedUntil: 0,
};

const createSettings = (passcode = createEmptyPasscode()): ProtectedSettings => ({
  enabled: true,
  contextMenu: true,
  blocked: ["youtube.com"],
  schedule: "*",
  passcode,
});

const createController = (passcode = createEmptyPasscode(), verifies = false) => {
  const write = jest.fn<Promise<void>, [Partial<ProtectedSettings>]>().mockResolvedValue();
  const controller = new ProtectedSettingsController(
    createSettings(passcode),
    write,
    async () => lockedPasscode,
    async () => verifies,
    () => 1_000,
  );
  return { controller, write };
};

test("protected settings can change only while unlocked", async () => {
  const unlocked = createController();
  const locked = createController(lockedPasscode);

  await expect(unlocked.controller.setSetting("enabled", false)).resolves.toBe(true);
  await expect(locked.controller.setSetting("enabled", false)).resolves.toBe(false);
  expect(unlocked.write).toHaveBeenCalledWith({ enabled: false });
  expect(locked.write).not.toHaveBeenCalled();
});

test("context menu rules can be added while settings are locked", async () => {
  const { controller, write } = createController(lockedPasscode);

  await expect(controller.addBlockedRule("example.com")).resolves.toEqual([
    "youtube.com",
    "example.com",
  ]);
  expect(write).toHaveBeenCalledWith({
    blocked: ["youtube.com", "example.com"],
  });
});

test("context menu additions cannot create allow rules", async () => {
  const { controller, write } = createController(lockedPasscode);

  await expect(controller.addBlockedRule("!youtube.com")).resolves.toBeUndefined();
  expect(write).not.toHaveBeenCalled();
});

test("concurrent context menu additions preserve every rule", async () => {
  const { controller, write } = createController(lockedPasscode);

  await Promise.all([
    controller.addBlockedRule("example.com"),
    controller.addBlockedRule("news.example.com"),
  ]);

  expect(controller.getSettings().blocked).toEqual([
    "youtube.com",
    "example.com",
    "news.example.com",
  ]);
  expect(write).toHaveBeenLastCalledWith({
    blocked: ["youtube.com", "example.com", "news.example.com"],
  });
});

test("direct storage changes are restored from trusted memory", async () => {
  const { controller, write } = createController(lockedPasscode);

  await controller.restoreUnauthorizedChanges({
    enabled: { newValue: false },
    blocked: { newValue: [] },
    passcode: { newValue: createEmptyPasscode() },
  });

  expect(write).toHaveBeenCalledWith({
    enabled: true,
    blocked: ["youtube.com"],
    passcode: lockedPasscode,
  });
});

test("a valid passcode clears the lock in the background", async () => {
  const { controller, write } = createController(lockedPasscode, true);

  await expect(controller.unlock("1234")).resolves.toBe(true);
  expect(write).toHaveBeenCalledWith({ passcode: createEmptyPasscode() });
  expect(controller.getLockState().hasPasscode).toBe(false);
});

test("failed attempts and retry delays are controlled by the background", async () => {
  const passcode = { ...lockedPasscode, failedAttempts: 4 };
  const { controller, write } = createController(passcode);

  await expect(controller.unlock("0000")).resolves.toBe(false);
  expect(write).toHaveBeenCalledWith({
    passcode: {
      ...passcode,
      failedAttempts: 5,
      lockedUntil: 61_000,
    },
  });
});

test("concurrent attempts cannot bypass the retry delay", async () => {
  const passcode = { ...lockedPasscode, failedAttempts: 4 };
  const { controller, write } = createController(passcode);

  const results = await Promise.all([controller.unlock("0000"), controller.unlock("0000")]);

  expect(results).toEqual([false, false]);
  expect(write).toHaveBeenCalledTimes(1);
  expect(controller.getLockState()).toMatchObject({
    failedAttempts: 5,
    lockedUntil: 61_000,
  });
});
