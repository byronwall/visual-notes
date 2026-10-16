import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readTestCredential } from "../e2e/helpers/credential";

const credentialFile = (mode: number) => {
  const path = join(mkdtempSync(join(tmpdir(), "vn-cred-")), "password");
  writeFileSync(path, "sentinel-value\n");
  chmodSync(path, mode);
  return path;
};

afterEach(() => vi.unstubAllEnvs());

describe("readTestCredential", () => {
  it("prefers an owner-only credential file and trims it", () => {
    vi.stubEnv("PLAYWRIGHT_MAGIC_PASSWORD_FILE", credentialFile(0o600));
    vi.stubEnv("PLAYWRIGHT_MAGIC_PASSWORD", "env-value");
    expect(readTestCredential()).toBe("sentinel-value");
  });

  it("refuses a group- or world-readable credential file without echoing it", () => {
    vi.stubEnv("PLAYWRIGHT_MAGIC_PASSWORD_FILE", credentialFile(0o644));
    expect(() => readTestCredential()).toThrow(/chmod 600/);
    try {
      readTestCredential();
    } catch (error) {
      expect(String(error)).not.toContain("sentinel-value");
    }
  });

  it("does not fall back to the local .env for an explicit server", () => {
    vi.stubEnv("PLAYWRIGHT_MAGIC_PASSWORD_FILE", "");
    vi.stubEnv("PLAYWRIGHT_MAGIC_PASSWORD", "");
    vi.stubEnv("MAGIC_PASSWORD", "");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "http://127.0.0.1:3115");
    expect(readTestCredential()).toBeNull();
  });
});
