#!/usr/bin/env node
// Seed a research topic from a fixture through the real REST ingest path.
//   node scripts/research-seed.mjs --base http://127.0.0.1:3122 --token <t> tests/fixtures/research/learn-rust-async.json
// Fixture: { title, rounds: [ingest payload...] }. Any "@ref" string in `under`,
// `links`, or `covers` resolves to the id an earlier round returned for that ref.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: "string", default: "http://127.0.0.1:3000" },
    token: { type: "string", default: process.env.RESEARCH_AGENT_TOKEN },
    slug: { type: "string" },
  },
});
if (!positionals.length || !values.token) {
  console.error("Usage: research-seed.mjs --base <url> --token <RESEARCH_AGENT_TOKEN> <fixture.json>...");
  process.exit(2);
}
const base = new URL(values.base);
if (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)) {
  console.error(`[research-seed] refusing non-loopback base ${base.origin}`);
  process.exit(2);
}

const call = async (method, path, body) => {
  const res = await fetch(new URL(path, base), {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${values.token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json, null, 2)}`);
  return json;
};

for (const file of positionals) {
  const fixture = JSON.parse(readFileSync(file, "utf8"));
  const topic = await call("POST", "/api/research/topics", { title: fixture.title, slug: values.slug });
  const known = {};
  const at = (ref) => {
    if (typeof ref !== "string" || !ref.startsWith("@")) return ref;
    const id = known[ref.slice(1)];
    if (!id) throw new Error(`Unknown fixture ref ${ref}`);
    return id;
  };
  for (const round of fixture.rounds) {
    const payload = {
      ...round,
      under: round.under === undefined ? undefined : at(round.under),
      links: round.links?.map((link) => ({ from: at(link.from), to: at(link.to) })),
      summaries: round.summaries?.map((s) => ({ ...s, covers: s.covers.map(at) })),
    };
    const result = await call("POST", `/api/research/topics/${topic.id}/ingest`, payload);
    for (const [ref, id] of Object.entries(result.refs)) if (!ref.startsWith("$")) known[ref] = id;
    console.info(`[research-seed] ${topic.slug} ${round.batchKey}: ${result.cardCount} cards, ${result.summaryCount} summaries`);
  }
  console.info(`[research-seed] ${new URL(`/research/${topic.slug}`, base)}`);
}
