import { describe, expect, it, vi } from "vitest";
import {
  createJevDecider,
  jevQuestions,
  normalizeJev,
  normalizeOpenai,
  openaiQuestions,
} from "./decide";
import type { Question } from "./questions";

const questions: Question[] = [
  { id: "stub", type: "noul", instructions: "Is it a stub?" },
  {
    id: "kind",
    type: "choice",
    instructions: "What kind?",
    options: [
      ["log", "A log."],
      ["other", "None fits."],
    ],
  },
  {
    id: "stale",
    type: "score",
    instructions: "How stale?",
    levels: [
      ["fresh", "Fresh."],
      ["old", "Old."],
    ],
  },
];

describe("vendor shapes", () => {
  it("builds Jev questions keyed by id with criteria", () => {
    expect(jevQuestions(questions)).toEqual({
      stub: { type: "noul", instructions: "Is it a stub?" },
      kind: {
        type: "choice",
        instructions: "What kind?",
        criteria: { log: "A log.", other: "None fits." },
      },
      stale: {
        type: "score",
        instructions: "How stale?",
        criteria: ["Fresh.", "Old."],
      },
    });
  });

  it("builds OpenAI predicates, choices, and levels", () => {
    const out = openaiQuestions(questions);
    expect(out[0]).toEqual({
      name: "stub",
      type: "predicate",
      instructions: "Is it a stub?",
    });
    expect(out[1].choices).toEqual([
      { value: "log", description: "A log." },
      { value: "other", description: "None fits." },
    ]);
    expect(out[2].levels?.[1]).toEqual({ label: "old", description: "Old." });
  });

  it("normalizes Jev answers, mapping score indexes to labels", () => {
    const answers = normalizeJev(questions, {
      answers: {
        stub: { noul: 0.91 },
        kind: { choice: "log", probabilities: { log: 0.8, other: 0.2 } },
        stale: { score: 1, probabilities: { "0": 0.3, "1": 0.7 } },
      },
    });
    expect(answers).toEqual({
      stub: { p: 0.91 },
      kind: { choice: "log", probs: { log: 0.8, other: 0.2 } },
      stale: { label: "old", probs: { fresh: 0.3, old: 0.7 } },
    });
  });

  it("normalizes OpenAI answers by name", () => {
    const answers = normalizeOpenai(questions, {
      answers: [
        { name: "stub", probability: 0.1 },
        {
          name: "kind",
          choice: "other",
          probabilities: [
            { value: "log", probability: 0.4 },
            { value: "other", probability: 0.6 },
          ],
        },
        {
          name: "stale",
          probabilities: [
            { label: "fresh", probability: 0.9 },
            { label: "old", probability: 0.1 },
          ],
        },
      ],
    });
    expect(answers.stub).toEqual({ p: 0.1 });
    expect(answers.kind).toEqual({
      choice: "other",
      probs: { log: 0.4, other: 0.6 },
    });
    expect(answers.stale).toEqual({
      label: "fresh",
      probs: { fresh: 0.9, old: 0.1 },
    });
  });
});

describe("createJevDecider", () => {
  it("sends the owner inside state and retries a 429", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("slow down", { status: 429 }))
      .mockResolvedValueOnce(
        Response.json({
          model: "jev-1.14.0",
          usage: { input_tokens: 1200 },
          answers: { stub: { noul: 0.2 } },
        }),
      );
    const decide = createJevDecider("key", fetchImpl as typeof fetch);
    const result = await decide({
      owner: { about: "me" },
      state: { note: { title: "t", body: "b" } },
      questions: [questions[0]],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(body.state).toEqual({
      owner: { about: "me" },
      note: { title: "t", body: "b" },
    });
    expect(result).toMatchObject({
      model: "jev-1.14.0",
      inputTokens: 1200,
      answers: { stub: { p: 0.2 } },
    });
  });

  it("throws on a non-retryable error", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("bad", { status: 400 }));
    const decide = createJevDecider("key", fetchImpl as typeof fetch);
    await expect(
      decide({ state: {}, questions: [questions[0]] }),
    ).rejects.toThrow(/400/);
  });
});
