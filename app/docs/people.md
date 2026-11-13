# People

People is a private relationship memory at `/people`. It is separate from notes. The scope and plan are in [docs/intent/people](../../docs/intent/people/shape-brief.md).

## Records and rules

| Record                                                      | Rule                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Person`                                                    | Never deleted; archive keeps history. `mergedIntoId` points from a merged profile to the kept one. One profile can be `isSelf`.                                                                                                                                                                                                                                                                  |
| `PersonFact`                                                | A short sourced detail. It never changes last contact. Retire it instead of deleting it.                                                                                                                                                                                                                                                                                                         |
| `Interaction` + `InteractionParticipant`                    | One encounter shared by its participants. Only participants with `countsAsContact` update last contact. Days are `date` columns in `America/Indiana/Indianapolis`; future days are refused.                                                                                                                                                                                                      |
| `PersonContact`                                             | The value is kept as typed. `matchValue` only finds duplicate candidates. Two people can share a value.                                                                                                                                                                                                                                                                                          |
| `Organization` + `PersonAffiliation`                        | A role is `employment` or `membership`, whatever the organization type. Status (`current`, `ended`, `unknown`) is stated, not read from an empty end date. Dates are partial strings (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`) with an approximate flag. `observedOn` limits a current claim. A role can carry its source and a unique `sourceKey`. Shared membership never makes two people acquainted. |
| `PersonExternalIdentity`, `PeopleImport`, `PeopleImportRow` | A repeat import matches people on the source and key. Each row commits on its own, so an apply can resume.                                                                                                                                                                                                                                                                                       |
| `PeopleReconnect`                                           | Opt-in cadence suggestions are computed on read. Only the user's actions on them are stored. Done, snooze, and dismiss never count as contact.                                                                                                                                                                                                                                                   |
| `PersonRelationship`                                        | Explicit typed edges. Symmetric pairs keep the lower id first. Introduction paths use only these edges.                                                                                                                                                                                                                                                                                          |

Last contact is computed on read (`server/people/recency.ts`). There is no cache: at 2,000 people the directory loads in under 40 ms.

## Career history

The profile leads with Experience: jobs newest start first, grouped by employer, with a new group for a return. Memberships stay in the side column. Rules live in `lib/people/career-periods.ts`:

- A month stays a month. A role ended with no known end day shows "end unknown". An undated listing is "Status unknown" and never counts as current.
- `compareRoles` returns `overlap` (the stated dates put both people there on one day), `possible` (the dates are too coarse), `none`, or `unknown` (a role has no dates). A current role counts only through `observedOn` (or its last write).
- The profile's "Also here" rows, introduction leads, and `people_get_organization` with `personId` all use `findColleagues`. A result is a lead, never a relationship.

`people_import_career` imports a career collection (Person URL, Company, Role, Start month, End month, Employment, Location, Source URL, Checked). Preview first. Apply writes one row per transaction, keyed `career-collection:<rowId>`, so a repeat or resumed run adds nothing. It completes an undated role with the same title instead of adding a copy. It reports a curated edit, two organizations with the company's name, or a LinkedIn profile owned by another person as a conflict. It writes no notes, so Recent and contact dates do not change.

The seed adds a fixed fixture, "Dana Whitfield", with a promotion, a return, an ended role without an end day, an undated listing, university work beside a school membership, and two colleagues.

## Code

- `lib/people/`: shared types, zod schemas, dates, CSV, and the layout helpers.
- `server/people/`: the stores. The UI server functions and the MCP tools call the same functions.
- `services/people/`: the `query()` reads and `action()` writes.
- `components/people/`: the UI. Routes in `routes/people/` only compose it.
- `server/mcp/people-tools.ts`: the `people_*` tools (see [mcp-connector.md](mcp-connector.md#people)).

Logs use the `[people]` prefix. Fact text, contact values, and raw imports never go into logs.

## Local data and tests

```sh
corepack pnpm audit:db -- --owner people
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/visual_notes_audit_people \
  AUTH_SECRET=local-seed-only-secret MAGIC_PASSWORD=x OPENAI_API_KEY= \
  corepack pnpm people:seed -- --count 40
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/visual_notes_audit_people corepack pnpm test:people
```

The seed refuses any database that is not a loopback `visual_notes_audit_*` one. Without `TEST_DATABASE_URL`, the `*.db.test.ts` files skip.
