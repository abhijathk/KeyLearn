import { randomInt } from "node:crypto";

const alphabet =
  "0123456789" + //
  "abcdefghijklmnopqrstuvwxyz" + //
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export class Random {
  // Uses a CSPRNG (crypto.randomInt is uniform / unbiased). These strings back
  // password-reset and magic-login tokens, so they must not be predictable —
  // Math.random() would be guessable and allow account takeover.
  static string(length: number): string {
    let result = "";
    for (let i = 0; i < length; i++) {
      result += alphabet.charAt(randomInt(alphabet.length));
    }
    return result;
  }
}
