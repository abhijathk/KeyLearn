import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { equal, notEqual, throws } from "rich-assert";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  resetTotpEncryptionKey,
  resolveTotpSecret,
} from "./totp-crypto.ts";

/** Runs a case against a fresh, disposable data directory, then cleans up. */
function withDataDir(run: (dataDir: string) => void): void {
  const dataDir = mkdtempSync(join(tmpdir(), "totp-crypto-test-"));
  resetTotpEncryptionKey();
  try {
    run(dataDir);
  } finally {
    resetTotpEncryptionKey();
    rmSync(dataDir, { recursive: true, force: true });
  }
}

test("a secret round-trips through encrypt and decrypt", () => {
  withDataDir((dataDir) => {
    const secret = "JBSWY3DPEHPK3PXP";
    const stored = encryptTotpSecret(secret, dataDir);
    notEqual(stored, secret);
    equal(decryptTotpSecret(stored, dataDir), secret);
  });
});

test("the same secret encrypts differently each time", () => {
  // A fresh random IV per call — never the same ciphertext twice for the
  // same plaintext, even under the same key.
  withDataDir((dataDir) => {
    const secret = "JBSWY3DPEHPK3PXP";
    notEqual(
      encryptTotpSecret(secret, dataDir),
      encryptTotpSecret(secret, dataDir),
    );
  });
});

test("a tampered stored value fails to decrypt", () => {
  withDataDir((dataDir) => {
    const stored = encryptTotpSecret("JBSWY3DPEHPK3PXP", dataDir);
    const tampered =
      stored.slice(0, -4) + (stored.slice(-4) === "AAAA" ? "BBBB" : "AAAA");
    throws(() => decryptTotpSecret(tampered, dataDir));
  });
});

test("resolveTotpSecret falls back to a legacy plaintext secret", () => {
  // Predates encryption: never went through encryptTotpSecret, so it won't
  // parse as a valid IV+tag+ciphertext — used as-is rather than rejected.
  withDataDir((dataDir) => {
    const legacy = "JBSWY3DPEHPK3PXP";
    equal(resolveTotpSecret(legacy, dataDir), legacy);
  });
});

test("resolveTotpSecret decrypts a real stored value rather than treating it as plaintext", () => {
  withDataDir((dataDir) => {
    const secret = "JBSWY3DPEHPK3PXP";
    const stored = encryptTotpSecret(secret, dataDir);
    equal(resolveTotpSecret(stored, dataDir), secret);
  });
});

test("a key persisted to disk is reused across calls", () => {
  withDataDir((dataDir) => {
    const secret = "JBSWY3DPEHPK3PXP";
    const stored = encryptTotpSecret(secret, dataDir);
    // A fresh "process" (cache reset) reading the same data directory must
    // still decrypt what an earlier one wrote — the key came from disk, not
    // from something only alive in memory.
    resetTotpEncryptionKey();
    equal(decryptTotpSecret(stored, dataDir), secret);
  });
});

test("TOTP_ENCRYPTION_KEY overrides the on-disk key when set", () => {
  withDataDir((dataDir) => {
    const had = process.env["TOTP_ENCRYPTION_KEY"];
    process.env["TOTP_ENCRYPTION_KEY"] = "a-configured-key";
    resetTotpEncryptionKey();
    try {
      const secret = "JBSWY3DPEHPK3PXP";
      const stored = encryptTotpSecret(secret, dataDir);
      // A second data directory, same configured key: still decryptable,
      // because the key came from the env var, not that directory's file.
      resetTotpEncryptionKey();
      equal(
        decryptTotpSecret(
          stored,
          mkdtempSync(join(tmpdir(), "totp-crypto-test-")),
        ),
        secret,
      );
    } finally {
      if (had === undefined) {
        delete process.env["TOTP_ENCRYPTION_KEY"];
      } else {
        process.env["TOTP_ENCRYPTION_KEY"] = had;
      }
      resetTotpEncryptionKey();
    }
  });
});
