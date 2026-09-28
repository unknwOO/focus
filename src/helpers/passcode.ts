export type PasscodeState = {
  hash: string;
  salt: string;
  failedAttempts: number;
  lockedUntil: number;
};

export const createEmptyPasscode = (): PasscodeState => ({
  hash: "",
  salt: "",
  failedAttempts: 0,
  lockedUntil: 0,
});

const ITERATIONS = 600_000;
const KEY_LENGTH = 256;

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const hexToBytes = (hex: string) =>
  new Uint8Array(hex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) || []);

const deriveHash = async (passcode: string, salt: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passcode),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: hexToBytes(salt),
      iterations: ITERATIONS,
    },
    key,
    KEY_LENGTH,
  );
  return bytesToHex(new Uint8Array(bits));
};

const hashesMatch = (left: string, right: string) => {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

export const createPasscode = async (passcode: string): Promise<PasscodeState> => {
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  return {
    hash: await deriveHash(passcode, salt),
    salt,
    failedAttempts: 0,
    lockedUntil: 0,
  };
};

export const verifyPasscode = async (passcode: string, state: PasscodeState) =>
  hashesMatch(await deriveHash(passcode, state.salt), state.hash);

export const getPasscodeRetryDelay = (failedAttempts: number) => {
  if (failedAttempts < 5) return 0;
  if (failedAttempts === 5) return 60_000;
  if (failedAttempts === 6) return 5 * 60_000;
  if (failedAttempts === 7) return 15 * 60_000;
  return 60 * 60_000;
};
