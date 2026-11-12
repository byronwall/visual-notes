---
title: "People — feature scope"
slug: people
phase: shape
status: current
last_updated: "2026-11-11"
---

# People — what we are adding

**Outcome:** Remember people, recover personal context, and find useful reasons to reconnect across life and work.

**Primary flow:** Find or create a person → remember a detail or log an encounter → recover it from the profile or agent.

## Feature scope

```text
People
├── PLANNED ADDITIONS: first useful release
│   ├── Directory and profiles
│   │   ├── Name, aliases, summary, location, contexts, contact methods, profile links
│   │   ├── Optional professional background, skills, and custom key/value fields
│   │   └── Search facts and encounters; filter contexts, organization, contact recency
│   ├── Personal memory
│   │   ├── Remember a detail: short text, optional category, source, learned date
│   │   ├── Edit or retire obsolete facts; show current facts above history
│   │   └── Log interaction: day, type, sentence, one or more participants
│   ├── Fast capture
│   │   ├── Profile actions and a global command; create a missing person inline
│   │   ├── Dictated text through existing device or agent input
│   │   └── MCP discovery/search/read; create/update profiles; append/correct facts; log/correct encounters
│   └── Life contexts and organizations
│       ├── Multiple affiliations, roles, and optional start/end dates
│       └── Organization pages and MCP read/write access to members, summary, and linked notes
├── PLANNED ADDITIONS: before broad population
│   ├── CSV import: mapping, preview, duplicate candidates, explicit apply
│   ├── Repeat import: stable source identity, visible conflicts, preserve curated values
│   └── Person merge: selected survivor, preserved history and links
├── PLANNED ADDITIONS: richer product, after memory proves useful
│   ├── Reconnect: reasons, supporting context, snooze, dismiss, resolved state
│   ├── On-demand relationship digest; scheduled delivery as a separate extension
│   ├── Typed person relationships entered from profiles
│   └── Focused network with explicit edges and possible introduction paths
└── EVALUATE BEFORE COMMITTING
    ├── In-app audio recording, if device/agent dictation leaves a real gap
    ├── Reconnect eligibility and thresholds; recommended default is opt-in
    └── Saved views and richer typed custom fields, after actual filter needs emerge
```

## Behavior

| Situation | Expected result |
| --- | --- |
| Remember a fact or edit a profile | Update memory; leave last contact unchanged. |
| Log a shared encounter | Create one interaction, shown on each participant's profile. |
| Record a referral without speaking to its subject | Save the event; only actual contact participants affect contact recency. |
| No interaction is recorded | Show “No recorded contact”; do not claim the people never spoke. |
| Two people share an employer or school | Show an affiliation; do not claim they know each other. |
| Several people match an agent request | Return candidates; make no write until the identity is clear. |
| A save fails | Retain the draft and report the error beside the action. |
| A person is archived | Keep history; omit them from normal directory and reconnect suggestions. |
| A note linked to a person is shared | Public output gains no People facts, contact details, or backlinks. |

## Examples

Fictional examples: “Sarah's oldest child enjoys robotics” is a fact. “Spoke with Sarah at the fundraiser yesterday” is an interaction. A single capture may contain both, but the manual form saves one mode at a time. An agent can create both when the source states both clearly.

“Alex recommended Jordan's work” can mention Jordan without recording a conversation with Jordan. Proposed participant roles distinguish direct contact from someone merely discussed. An introduction edge is added only when the relationship is explicit.

## Decisions and boundaries

**Appetite:** Prove memory with 25–50 fictional profiles first. Deliver reliable capture, retrieval, organizations, and import before broad population. Reconnect and network capabilities remain planned follow-on work. No calendar estimate is assumed.

**Key decision:** Use dedicated People records with optional note links. A Collection-only version is smaller, but makes shared encounters and identity reconciliation awkward. Reuse existing UI primitives, stores, and MCP registration. Keep facts out of `Doc.meta` and real-world encounters out of `ActionEvent`.

**Key decision:** Keep reconnect separate from Tasks, as selected. Build relationship entry before graph rendering. Treat organization membership as context, not evidence of acquaintance.

**Boundary:** All People records remain private. Omit the mockup's optional “Private” toggle, decorative global Undo, and new agent panel from the first scope. Device/agent dictation proves voice input without a new recording service. Existing notes continue unchanged. An additive rollout can hide People routes and tool registration while retaining saved records.

**First proof:** Test whether short capture produces useful recall.

**Try:** With fictional local data, save a personal detail and a two-person encounter, reload, then search by the detail.

**Observe:** Both records persist, the right profiles show the encounter, and only direct contact updates recency. Target recall within 15 seconds.

**Decide:** Continue if capture and recall work without duplicate entry or a full note editor. Simplify the form if capture friction defeats that result. The timing target is a proposed usability measure.

The [intent brief](intent-brief.md) explains purpose. The [implementation plan](implementation-plan.md) details data, screens, risks, and proof order.
