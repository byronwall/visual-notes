// Database-backed unit tests (`*.db.test.ts`) run against a real Postgres
// only when TEST_DATABASE_URL points at a loopback database named
// visual_notes_audit_* or visual_notes_ci; otherwise they skip.
export const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? process.env.RESEARCH_TEST_DATABASE_URL;

export const isSafeTestDb = (value: string | undefined) => {
  if (!value) return false;
  const parsed = new URL(value);
  return (
    ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) &&
    /^\/(visual_notes_audit_\w+|visual_notes_ci)$/.test(parsed.pathname)
  );
};

export const testDatabaseEnabled = isSafeTestDb(testDatabaseUrl);
