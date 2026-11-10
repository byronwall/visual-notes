// Scores the in-app pathway agent on fixed cases across models.
//
//   pnpm eval:pathways -- --models gpt-5.4-mini,gpt-5.5:high [--cases name,...]
//                         [--judge gpt-5.5] [--out tmp/pathways-eval/<name>]
//   pnpm eval:pathways -- --rejudge tmp/pathways-eval/<name>
//
// Cases: scripts/pathways-eval/cases/*.json (committed, invented people) and
// tmp/pathways-eval/cases/*.json (local only, real maps). Each run writes
// results.json and report.md under --out. The prompts come from the app
// (agent-input.ts), so a run scores exactly what the app sends.

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { applyOps } from "~/lib/pathways/graph-ops";
import { emptyGraph, type PathwayGraph } from "~/lib/pathways/types";
import {
  firstAction,
  mapPrompt,
  replyToOps,
  type MapInput,
} from "~/server/pathways/agent-input";
import { schemaFor, type MapAction } from "~/server/pathways/agent-prompts";

type Case = {
  name: string;
  source: string;
  action: MapAction;
  nodeId: string;
  hint: string;
  now: string;
  record: MapInput;
  goodLooksLike: string;
};

type Scores = {
  grounded: number;
  actionable: number;
  distinct: number;
  structure: number;
  faithful: number;
  followsPerson: number;
  overall: number;
  critique: string;
};

type Result = {
  case: string;
  model: string;
  effort: string;
  action: string;
  ms: number;
  tokens: { input: number; output: number };
  summary: string;
  tree: string;
  added: number;
  dropped: number;
  error?: string;
  scores?: Scores;
};

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

function apiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  // Only OPENAI_API_KEY is read from the main checkout's app/.env.
  const common = execSync(
    "git rev-parse --path-format=absolute --git-common-dir",
    {
      encoding: "utf8",
    },
  ).trim();
  const line = fs
    .readFileSync(path.join(path.dirname(common), "app", ".env"), "utf8")
    .split("\n")
    .find((l) => l.startsWith("OPENAI_API_KEY="));
  const key = line
    ?.slice(15)
    .trim()
    .replace(/^["']|["']$/g, "");
  if (!key)
    throw new Error("No OPENAI_API_KEY in the shell or the main app/.env");
  return key;
}
const KEY = apiKey();

async function respond(opts: {
  model: string;
  effort: string;
  input: string;
  schema: Record<string, unknown>;
}) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model: opts.model,
      input: opts.input,
      reasoning: { effort: opts.effort },
      text: {
        format: {
          type: "json_schema",
          strict: true,
          name: "out",
          schema: opts.schema,
        },
      },
    }),
  });
  const json = await res.json();
  if (!res.ok)
    throw new Error(
      `OpenAI ${res.status}: ${JSON.stringify(json).slice(0, 300)}`,
    );
  const text: string =
    json.output_text ??
    json.output
      ?.flatMap((o: { content?: { text?: string }[] }) => o.content ?? [])
      .map((c: { text?: string }) => c.text ?? "")
      .join("");
  return {
    data: JSON.parse(text),
    tokens: {
      input: json.usage?.input_tokens ?? 0,
      output: json.usage?.output_tokens ?? 0,
    },
  };
}

/** The map as an indented outline: new cards starred, joins marked. */
export function renderTree(before: PathwayGraph, after: PathwayGraph) {
  const old = new Set(before.nodes.map((n) => n.id));
  const byId = new Map(after.nodes.map((n) => [n.id, n]));
  const kids = new Map<string, string[]>();
  for (const e of after.edges)
    kids.set(e.from, [...(kids.get(e.from) ?? []), e.to]);
  const seen = new Set<string>();
  const lines: string[] = [];
  const walk = (id: string, depth: number) => {
    const n = byId.get(id);
    if (!n) return;
    const pad = "  ".repeat(depth);
    const mark = `${old.has(id) ? "" : "*"}${n.status === "dropped" ? "~" : ""}${n.status === "done" ? "✓" : ""}`;
    if (seen.has(id)) {
      lines.push(`${pad}- ↪ joins ${mark}${n.title}`);
      return;
    }
    seen.add(id);
    const research = n.research?.question
      ? ` [research: ${n.research.question}]`
      : "";
    const basis = n.fromResearch
      ? ` [from research on ${n.fromResearch.nodeId}; sources: ${n.fromResearch.sources.map((s) => s.title).join(", ") || "none"}]`
      : "";
    lines.push(
      `${pad}- ${mark}[${n.kind}] ${n.title}${n.note ? ` — ${n.note}` : ""}${research}${basis}`,
    );
    for (const k of kids.get(id) ?? []) walk(k, depth + 1);
  };
  walk("root", 0);
  const orphans = after.nodes.filter((n) => !seen.has(n.id));
  if (orphans.length)
    lines.push(
      "(unlinked)",
      ...orphans.map((n) => `- *[${n.kind}] ${n.title}`),
    );
  return lines.join("\n");
}

async function runCase(c: Case, spec: string): Promise<Result> {
  const [model, effort = "medium"] = spec.split(":");
  const action = firstAction(c.action, c.record.graph, c.nodeId);
  const base = { case: c.name, model, effort, action };
  const prompt = mapPrompt(action, c.record, c.nodeId, c.hint, new Date(c.now));
  const t0 = Date.now();
  try {
    const { data, tokens } = await respond({
      model,
      effort,
      input: `${prompt.system}\n\n${prompt.user}`,
      schema: schemaFor(action),
    });
    // Like the app, a fresh map starts from an empty graph, not the old one.
    const from =
      action === "regenerate" ? emptyGraph(c.record.title) : c.record.graph;
    const r = applyOps(
      from,
      replyToOps(data, action === "fromResearch" ? c.nodeId : undefined),
      "agent",
    );
    return {
      ...base,
      ms: Date.now() - t0,
      tokens,
      summary: data.summary,
      tree: renderTree(from, r.graph),
      added: r.added.length,
      dropped: r.dropped.length,
    };
  } catch (err) {
    return {
      ...base,
      ms: Date.now() - t0,
      tokens: { input: 0, output: 0 },
      summary: "",
      tree: "",
      added: 0,
      dropped: 0,
      error: String(err),
    };
  }
}

const score = { type: "integer", minimum: 1, maximum: 5 };
const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "grounded",
    "actionable",
    "distinct",
    "structure",
    "faithful",
    "followsPerson",
    "overall",
    "critique",
  ],
  properties: {
    grounded: score,
    actionable: score,
    distinct: score,
    structure: score,
    faithful: score,
    followsPerson: score,
    overall: { type: "integer", minimum: 1, maximum: 10 },
    critique: { type: "string" },
  },
};

async function judge(c: Case, r: Result, model: string): Promise<Scores> {
  const input = `You grade an AI assistant that builds decision maps (a question, options, steps, outcomes) for one person. Be strict; a 5 is rare and means a thoughtful human coach could not do much better.

Situation the assistant saw:
${mapPrompt(r.action as MapAction, c.record, c.nodeId, c.hint, new Date(c.now)).user}

What a great answer does here:
${c.goodLooksLike}

The map after the assistant acted (* = card it added, ~ = dropped, ✓ = done (finished; hidden from the person's map), ↪ joins = edge into a card shown earlier):
${r.tree}

Its summary: ${r.summary}

Score 1-5 each:
- grounded: uses this person's specifics (names, dates, constraints, stack). A card that would fit anyone's map scores low.
- actionable: steps are concrete moves the person could start this week.
- distinct: options are genuinely different routes; no meta options ("list everything", "make a plan"); no duplicates.
- structure: options lead to steps and outcomes; paths that meet share a card; new cards sit under the card they belong to.
- faithful: no invented facts; unknowns become research questions or are named as unknown.
- followsPerson: follows the person's goals, limits, reactions, and notes.
overall: 1-10, how useful this map is to the person right now.
critique: two sentences, the biggest strength and the biggest problem.`;
  const { data } = await respond({
    model,
    effort: "high",
    input,
    schema: JUDGE_SCHEMA,
  });
  return data;
}

async function pool<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

function loadCases(only?: string[]) {
  const dirs = ["scripts/pathways-eval/cases", "tmp/pathways-eval/cases"];
  return dirs
    .filter((d) => fs.existsSync(d))
    .flatMap((d) =>
      fs
        .readdirSync(d)
        .filter((f) => f.endsWith(".json"))
        .map(
          (f) => JSON.parse(fs.readFileSync(path.join(d, f), "utf8")) as Case,
        ),
    )
    .filter((c) => !only || only.includes(c.name));
}

const avg = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

function report(results: Result[], cases: Case[], judgeModel: string) {
  const models = [...new Set(results.map((r) => `${r.model}:${r.effort}`))];
  const keys = [
    "overall",
    "grounded",
    "actionable",
    "distinct",
    "structure",
    "faithful",
    "followsPerson",
  ] as const;
  const rows = models.map((m) => {
    const rs = results.filter(
      (r) => `${r.model}:${r.effort}` === m && r.scores,
    );
    const cells = keys.map((k) => avg(rs.map((r) => r.scores![k])).toFixed(1));
    const secs = avg(
      results
        .filter((r) => `${r.model}:${r.effort}` === m)
        .map((r) => r.ms / 1000),
    ).toFixed(0);
    const toks = avg(rs.map((r) => r.tokens.output)).toFixed(0);
    return `| ${m} | ${cells.join(" | ")} | ${secs}s | ${toks} |`;
  });
  const perCase = cases.map((c) => {
    const cell = models.map((m) => {
      const r = results.find(
        (x) => x.case === c.name && `${x.model}:${x.effort}` === m,
      );
      return r?.error ? "err" : String(r?.scores?.overall ?? "-");
    });
    return `| ${c.name} | ${cell.join(" | ")} |`;
  });
  const detail = cases.flatMap((c) => [
    `## ${c.name}`,
    `${c.source}. Great looks like: ${c.goodLooksLike}`,
    ...results
      .filter((r) => r.case === c.name)
      .flatMap((r) => [
        `### ${r.model}:${r.effort} — ${r.scores?.overall ?? "?"}/10 (${(r.ms / 1000).toFixed(0)}s, action ${r.action})`,
        r.error
          ? `Error: ${r.error}`
          : `> ${r.scores?.critique ?? ""}\n\nSummary: ${r.summary}\n\n${r.tree}`,
      ]),
  ]);
  return [
    `# Pathways eval (judge: ${judgeModel})`,
    "",
    `| model | overall/10 | grounded | actionable | distinct | structure | faithful | follows | time | out tokens |`,
    `|---|---|---|---|---|---|---|---|---|---|`,
    ...rows,
    "",
    `| case | ${models.join(" | ")} |`,
    `|---|${models.map(() => "---").join("|")}|`,
    ...perCase,
    "",
    ...detail,
  ].join("\n");
}

async function main() {
  const judgeModel = arg("judge") ?? "gpt-5.5";
  const rejudge = arg("rejudge");
  const out =
    rejudge ??
    arg("out") ??
    `tmp/pathways-eval/${new Date().toISOString().slice(0, 16).replace(/:/g, "")}`;
  const cases = loadCases(arg("cases")?.split(","));
  let results: Result[];
  if (rejudge) {
    results = JSON.parse(
      fs.readFileSync(path.join(out, "results.json"), "utf8"),
    );
  } else {
    const models = (arg("models") ?? "gpt-5.4-mini").split(",");
    const jobs = cases.flatMap((c) => models.map((m) => ({ c, m })));
    console.info(
      `[pathways-eval] ${jobs.length} runs: ${cases.length} cases x ${models.join(", ")}`,
    );
    results = await pool(jobs, 8, async ({ c, m }) => {
      const r = await runCase(c, m);
      console.info(
        `[pathways-eval] ${c.name} ${m} ${r.error ? "ERROR" : "ok"} ${(r.ms / 1000).toFixed(0)}s`,
      );
      return r;
    });
  }
  await pool(results, 8, async (r) => {
    const c = cases.find((x) => x.name === r.case);
    if (!c || r.error) return;
    r.scores = await judge(c, r, judgeModel).catch((err) => {
      console.warn(`[pathways-eval] judge failed on ${r.case} ${r.model}`, err);
      return undefined;
    });
  });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify(results, null, 2),
  );
  fs.writeFileSync(
    path.join(out, "report.md"),
    report(results, cases, judgeModel),
  );
  console.info(`[pathways-eval] wrote ${out}/report.md`);
}

void main();
