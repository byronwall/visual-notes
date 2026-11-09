# Pathways agent: prompts, models, and evals

The in-app pathway agent (`src/server/pathways/agent.ts`) reads a map as text and asks an OpenAI model for a structured edit. `agent-input.ts` builds the text, and `agent-prompts.ts` holds the prompts and the reply schema. Both have no database code, so the eval script sends the same prompts as the app.

## Models

| Setting              | Default                        | Used for                                               |
| -------------------- | ------------------------------ | ------------------------------------------------------ |
| `PATHWAYS_MODEL`     | `gpt-6.1-terra`, medium effort | Every action except whole-map builds, and web research |
| `PATHWAYS_MAP_MODEL` | `gpt-6.1-sol`, low effort      | `start` (first map) and `regenerate` (fresh map)       |

Prod does not set either variable, so a change to the defaults ships with the code.

## First map

A map that has only its question runs `start`, not `options`. The app sends "More choices" (`options` on root) for a new map. `firstAction()` changes that request to `start`. `start` builds 3 to 6 options, each with steps and an outcome. A bare `options` call gave four generic root cards, such as "Do nothing for now".

## Evals

```bash
cd app
pnpm eval:pathways -- --models gpt-6.1-terra:medium,gpt-6.1-sol:low
pnpm eval:pathways -- --rejudge tmp/pathways-eval/<run>
```

- Cases are in `scripts/pathways-eval/cases/*.json`. They use invented people because the repository is public. Put cases from real maps in `tmp/pathways-eval/cases/`, which git ignores.
- Each case has a map, an action, and `goodLooksLike`, which the judge reads.
- The judge (`--judge`, default `gpt-5.5`) scores grounding, actionability, distinct options, structure, faithfulness, and how well the map follows the person, plus an overall score out of 10.
- The output is `tmp/pathways-eval/<run>/report.md`. It has a score table and each map as an outline (`*` = added, `~` = dropped).
- Read the outlines, not only the scores. The judge is an OpenAI model and can prefer OpenAI-style answers.

### Results, November 9, 2026 (7 cases, 2 from real maps)

| Setup                                                 | Overall/10 |
| ----------------------------------------------------- | ---------- |
| Old prompts, `gpt-5.4-mini` (prod before this change) | 4.4        |
| New prompts, `gpt-5.4-mini`                           | 7.0        |
| New prompts, `gpt-6-luna` medium                      | 7.9        |
| New prompts, `gpt-6.1-terra` medium                   | 8.4        |
| New prompts, `gpt-6.1-sol` low                        | 8.7        |
| New prompts, `gpt-5.5` medium                         | 8.6        |

On `start`, Sol low scored 8.8 and Terra 8.4. On `improve`, both scored 8.5.
