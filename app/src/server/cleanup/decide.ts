import type { Question } from "./questions";

/**
 * One helper for typed, probability-scored answers to bounded questions.
 * Jev (TypeSafe) is the default; OpenAI Decisions is a drop-in alternative.
 * The `heuristic` provider answers from code-computed facts only: it keeps the
 * pipeline usable in local and audit runs that have no vendor key, and its
 * model name says so wherever results show.
 */

export type DecisionProvider = "jev" | "openai" | "heuristic";

export type Answer =
  | { p: number }
  | { choice: string; probs: Record<string, number> }
  | { label: string; probs: Record<string, number> };

export type Answers = Record<string, Answer>;

export type DecideResult = {
  model: string;
  answers: Answers;
  inputTokens: number | null;
  latencyMs: number;
};

export type DecideInput = {
  /** Context every question shares, such as the owner profile. */
  owner?: unknown;
  state: Record<string, unknown>;
  questions: Question[];
};

export type Decider = (input: DecideInput) => Promise<DecideResult>;

const LOG_PREFIX = "[cleanup-decide]";
export const JEV_MODEL = "jev-1.14.0";
export const OPENAI_DECISIONS_MODEL = "gpt-6-luna";
export const HEURISTIC_MODEL = "heuristic-v1";
const RETRIES = 3;

type FetchLike = typeof fetch;

async function postJson(
  url: string,
  key: string,
  body: unknown,
  fetchImpl: FetchLike,
): Promise<any> {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    const retryable = [429, 500, 502, 503, 529].includes(res.status);
    const text = (await res.text()).slice(0, 400);
    if (!retryable || attempt >= RETRIES) {
      throw new Error(`${url} ${res.status}: ${text}`);
    }
    console.warn(`${LOG_PREFIX} retrying after ${res.status}`);
    await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
  }
}

const argmax = (probs: Record<string, number>) =>
  Object.entries(probs).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

export function jevQuestions(questions: Question[]) {
  return Object.fromEntries(
    questions.map((q) => {
      if (q.type === "noul") {
        return [q.id, { type: "noul", instructions: q.instructions }];
      }
      if (q.type === "choice") {
        return [
          q.id,
          {
            type: "choice",
            instructions: q.instructions,
            criteria: Object.fromEntries(q.options),
          },
        ];
      }
      return [
        q.id,
        {
          type: "score",
          instructions: q.instructions,
          criteria: q.levels.map(([, description]) => description),
        },
      ];
    }),
  );
}

export function normalizeJev(questions: Question[], resp: any): Answers {
  const out: Answers = {};
  for (const q of questions) {
    const a = resp?.answers?.[q.id];
    if (!a) continue;
    if (q.type === "noul") out[q.id] = { p: Number(a.noul) };
    else if (q.type === "choice") {
      out[q.id] = { choice: a.choice, probs: a.probabilities ?? {} };
    } else {
      const probs: Record<string, number> = {};
      for (const [index, p] of Object.entries(a.probabilities ?? {})) {
        const level = q.levels[Number(index)];
        if (level) probs[level[0]] = Number(p);
      }
      out[q.id] = { label: argmax(probs), probs };
    }
  }
  return out;
}

export function openaiQuestions(questions: Question[]) {
  return questions.map((q) => {
    if (q.type === "noul") {
      return { name: q.id, type: "predicate", instructions: q.instructions };
    }
    if (q.type === "choice") {
      return {
        name: q.id,
        type: "choice",
        instructions: q.instructions,
        choices: q.options.map(([value, description]) => ({
          value,
          description,
        })),
      };
    }
    return {
      name: q.id,
      type: "score",
      instructions: q.instructions,
      levels: q.levels.map(([label, description]) => ({ label, description })),
    };
  });
}

export function normalizeOpenai(questions: Question[], resp: any): Answers {
  const byName = new Map<string, any>(
    (resp?.answers ?? []).map((a: any) => [a.name, a]),
  );
  const out: Answers = {};
  for (const q of questions) {
    const a = byName.get(q.id);
    if (!a) continue;
    if (q.type === "noul") {
      out[q.id] = { p: Number(a.probability) };
      continue;
    }
    const key = q.type === "choice" ? "value" : "label";
    const probs = Object.fromEntries(
      (a.probabilities ?? []).map((p: any) => [p[key], Number(p.probability)]),
    );
    out[q.id] =
      q.type === "choice"
        ? { choice: a.choice, probs }
        : { label: argmax(probs), probs };
  }
  return out;
}

export function createJevDecider(
  key: string,
  fetchImpl: FetchLike = fetch,
): Decider {
  return async ({ owner, state, questions }) => {
    const started = Date.now();
    const resp = await postJson(
      "https://api.typesafe.ai/v1/systemone",
      key,
      {
        model: JEV_MODEL,
        state: owner ? { owner, ...state } : state,
        questions: jevQuestions(questions),
      },
      fetchImpl,
    );
    return {
      model: resp?.model ?? JEV_MODEL,
      answers: normalizeJev(questions, resp),
      inputTokens: resp?.usage?.input_tokens ?? null,
      latencyMs: Date.now() - started,
    };
  };
}

export function createOpenaiDecider(
  key: string,
  fetchImpl: FetchLike = fetch,
): Decider {
  return async ({ owner, state, questions }) => {
    const started = Date.now();
    const input: unknown[] = [];
    // The owner profile goes first so the prefix cache can serve it.
    if (owner) {
      input.push({
        role: "developer",
        content: [
          {
            type: "input_text",
            text: `The JSON below is about notes kept by \`owner\`. owner = ${JSON.stringify(owner)}`,
          },
        ],
      });
    }
    input.push({
      role: "user",
      content: [{ type: "input_json", data: state }],
    });
    const resp = await postJson(
      "https://api.openai.com/v1/decisions",
      key,
      {
        model: OPENAI_DECISIONS_MODEL,
        input,
        questions: openaiQuestions(questions),
      },
      fetchImpl,
    );
    return {
      model: resp?.model ?? OPENAI_DECISIONS_MODEL,
      answers: normalizeOpenai(questions, resp),
      inputTokens: resp?.usage?.input_tokens ?? null,
      latencyMs: Date.now() - started,
    };
  };
}
