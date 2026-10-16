import { afterAll, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { jobsDb } from "./jobs-db";

const originalCwd = process.cwd();
const isolatedRoot = await mkdtemp(path.join(os.tmpdir(), "jobs-db-test-"));
process.chdir(isolatedRoot);

afterAll(async () => {
  process.chdir(originalCwd);
  await rm(isolatedRoot, { recursive: true, force: true });
});

it("continues queued writes after a missing-job update rejects", async () => {
  const db = jobsDb();
  await db.createJob("umap_train", null, "existing");

  await expect(
    db.updateJob("missing", { error: "expected failure" }),
  ).rejects.toThrow("Job not found");

  const updated = await db.updateJob("existing", { error: "later update" });
  const created = await db.createJob("umap_train", null, "later-create");
  const savedUpdate = JSON.parse(
    await readFile(path.join(isolatedRoot, "data/jobs/existing.json"), "utf8"),
  );
  const savedCreate = JSON.parse(
    await readFile(path.join(isolatedRoot, "data/jobs/later-create.json"), "utf8"),
  );

  expect(updated.error).toBe("later update");
  expect(savedUpdate.error).toBe("later update");
  expect(created.id).toBe("later-create");
  expect(savedCreate.id).toBe("later-create");
});
