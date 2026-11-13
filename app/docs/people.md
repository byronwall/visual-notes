# People

People is a private relationship memory at `/people`. It is separate from notes. It holds everyone, not only work contacts, and is sized for about 2,000 people.

## Scope and decisions

- People has its own records, with optional links to notes. It does not use Collections, `Doc.meta`, or `ActionEvent`. Shared encounters and repeat imports need real identity.
- A remembered fact and an encounter are different records. Only an encounter changes last contact, and only for participants who spoke (`countsAsContact`). A person who is only discussed, as in a referral, does not.
- "No recorded contact" means no data. It never means the people did not speak.
- A shared organization is context. It never makes two people acquainted. Introduction paths use only recorded `PersonRelationship` edges; a shared employer shows as a labeled lead.
- Reconnect is its own queue, not Tasks. It is opt-in per person (cadence of 1 to 12 months) or an explicit reason. The digest is on demand only.
- All People data is private. A shared note never shows People facts, contacts, or backlinks.
- Agents use the same stores and rules as the UI. A name that matches more than one person returns candidates and writes nothing. Agents can archive but not delete, and never send outreach. Merge and import stay in the app.
- Voice capture uses device or agent dictation into the text fields. There is no in-app recorder for People.
- Out of scope: automatic profile sync, email or calendar ingestion, pre-meeting briefings, outreach, public profiles, and a generic graph or entity layer.

## Records and rules

| Record                                                      | Rule                                                                                                                                                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Person`                                                    | Never deleted; archive keeps history. `mergedIntoId` points from a merged profile to the kept one. One profile can be `isSelf`.                                                             |
| `PersonFact`                                                | A short sourced detail. It never changes last contact. Retire it instead of deleting it.                                                                                                    |
| `Interaction` + `InteractionParticipant`                    | One encounter shared by its participants. Only participants with `countsAsContact` update last contact. Days are `date` columns in `America/Indiana/Indianapolis`; future days are refused. |
| `PersonContact`                                             | The value is kept as typed. `matchValue` only finds duplicate candidates. Two people can share a value.                                                                                     |
| `Organization` + `PersonAffiliation`                        | Shared membership is context. It never makes two people acquainted. An end day records a past role.                                                                                         |
| `PersonExternalIdentity`, `PeopleImport`, `PeopleImportRow` | A repeat import matches people on the source and key. Each row commits on its own, so an apply can resume.                                                                                  |
| `PeopleReconnect`                                           | Opt-in cadence suggestions are computed on read. Only the user's actions on them are stored. Done, snooze, and dismiss never count as contact.                                              |
| `PersonRelationship`                                        | Explicit typed edges. Symmetric pairs keep the lower id first. Introduction paths use only these edges.                                                                                     |

Last contact is computed on read (`server/people/recency.ts`). There is no cache: at 2,000 people the directory loads in under 40 ms.

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

## Open items

- The reconnect cadence choices (1, 2, 3, 6, 12 months) are a first guess. Review real suggestions before adding any bulk or default cadence.
- Scheduled digest delivery is not built.
- An agent write does not refresh People pages that are already open. They update on reload.
- People uses the existing `notes:read` and `notes:write` MCP scopes. No live OAuth round trip has been run against the People tools.
