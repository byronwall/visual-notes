---
title: "People: personal relationship memory"
slug: people
phase: intent
status: current
last_updated: "2026-11-11"
---

# People: personal relationship memory

## My read

People should give Byron one private place to remember people across work, school, family, and social life. The central job is to capture small details and recover useful context later. Today, those details become loose notes or remain scattered across external profiles. A dedicated People area should make them easier to enter, find, correct, and connect.

The scope includes everyone, rather than only active professional contacts. Byron selected overlapping estimates of 100–500 and 500–2,000 people. Treat 2,000 as a useful first scale target, not a fixed requirement. Job searching and networking are supported uses within this broader personal system.

Profiles must hold both professional and personal information. Brief interactions preserve meaningful encounters without requiring meeting notes or action items. Capture should work from a profile, a global form, dictation, and connected agents. The preferred interaction is a date and one sentence, with several participants when needed.

Reconnection is a second value: suggest someone worth contacting based on recorded history or a known event. Byron explicitly chose a separate People queue. The earlier assistant proposal to use Tasks does not override that choice. Typed relationships, introduction paths, and a network view belong in the intended richer product. They should follow useful capture and reliable connection data.

## What matters most

- Replace scattered personal information with a searchable, structured memory.
- Make entry short enough to use after ordinary encounters.
- Preserve distinct meanings for a person, a remembered fact, and an interaction.
- Support UI and MCP discovery, search, read, create, update, append, and log operations over the same records and rules.
- Retain useful context across several life settings and organizations.
- Help relationships continue without creating another task backlog.

## The experience or behavior you appear to want

Find a person by name, organization, context, or remembered detail. Read what matters near the top of the profile. Add a fact or brief encounter without opening the note editor. Later, ask an agent or use search to recover the detail. See relevant people together through affiliations, explicit relationships, and eventually a focused network.

## Boundaries

Capture concerns personal relationships. Business meeting records, action items, sales stages, full communication archives, and automatic outreach fall outside this scope. External profile links, CSV imports, and manual reimports are selected; automatic profile synchronization and email/calendar ingestion are not.

Private conversation details are allowed. The simultaneous selection of “public information only” does not establish a workable field-level privacy policy. Use private-by-default storage as the recommended conservative interpretation. Public sharing and special sensitivity controls remain separate choices.

Agents may proactively create records and reconnection prompts. That preference does not authorize inferred facts, silent identity guesses, contact scraping, or sending messages. The current request authorizes planning, not implementation or data collection.

## What seems settled

- Everyone can have a profile; professional information is optional.
- Profiles include contact links, personal details, professional background, and custom fields.
- Companies need pages, associated people, notes, and history.
- In-person encounters, social conversations, introductions, referrals, and recommendations matter.
- Interactions stay brief and can include multiple participants.
- Reconnection uses a dedicated People queue.
- Imports must support repeat runs and duplicate review.
- Directory, timeline, graph, agent capture/querying, and a digest are selected capabilities.

## Possibilities, not decisions

Separate fact records, generic organizations, an opt-in reconnect policy, and the proposed schema are design recommendations. School and church contexts support generic organizations, but the questionnaire explicitly selected company pages. A native mobile app, strict contact cadence, automated relationship scores, and pre-meeting briefings are not required. Mockup controls and fictional records are examples.

## Current reality that matters

GitHub `main` has Collections, Places, Events, shared server stores, and an OAuth-backed MCP registry. It has no People model. This local branch predates several foundations. Base implementation on current `main`, after preserving existing work. The [implementation plan](implementation-plan.md) records exact source anchors and the branch gap. Existing public note sharing makes accidental People expansion a concrete boundary to test.

## Next step after confirmation

Use the [shape brief](shape-brief.md) to assess scope. Then begin the plan's local capture-and-recall proof. No new questionnaire is needed to start that reversible proof. Reconnect eligibility and delivery frequency can remain provisional until that stage.
