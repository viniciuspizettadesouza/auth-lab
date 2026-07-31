import { createHash, randomBytes, randomInt } from "node:crypto";

const userCodeAlphabet = "BCDFGHJKLMNPQRSTVWXZ23456789";

export function randomDeviceCode() {
  return randomBytes(32).toString("base64url");
}

export function digestDeviceValue(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

export function createUserCode() {
  const characters = Array.from(
    { length: 8 },
    () => userCodeAlphabet[randomInt(0, userCodeAlphabet.length)]
  );
  return `${characters.slice(0, 4).join("")}-${characters.slice(4).join("")}`;
}

export function normalizeUserCode(value: string) {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return compact.length === 8 &&
    Array.from(compact).every((character) => userCodeAlphabet.includes(character))
    ? `${compact.slice(0, 4)}-${compact.slice(4)}`
    : "";
}
