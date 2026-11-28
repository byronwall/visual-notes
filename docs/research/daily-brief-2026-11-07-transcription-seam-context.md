---
title: Transcription continuity across upload seams
origin: repo-reading-brief
topic_id: visual-notes.transcription-seam-context.v1
source_edition: 2026-11-07
source_edition_url: https://chatgpt.com/space/page_e27753f301d4819192358db0b5691041
status: research-proposal
baseline_commit: 474bc0b99c6f6f4da90be896ee1a12bad8bb08fa
---

# Transcription continuity across upload seams

Assistant-generated research. Origin: `repo-reading-brief`. Stable topic ID: `visual-notes.transcription-seam-context.v1`. Source edition: [November 7, 2026](https://chatgpt.com/space/page_e27753f301d4819192358db0b5691041). Exclude this document, its branch, PR and derivative assistant research from future substantive-activity ranking. This proposal is not implementation authorization or new product activity.

## Scope and decision to investigate

[PR #297](https://github.com/byronwall/visual-notes/pull/297) fixed oversized uploads by re-encoding recordings and splitting long ones. It also explicitly acknowledges that an hour boundary can cut a word. The next question is narrow: does moving an upload boundary away from speech improve raw transcription continuity without losing global playback positions?

Keep the current upload-size fix. Do not infer that it is defective from a different system's benchmark. Investigate boundary placement before adding overlap, carrying previous transcript text into prompts, replacing the provider or changing the queue. All experiments below are proposed and unrun.

## Source and its limits

Max Bain, Jaesung Huh, Tengda Han and Andrew Zisserman, [WhisperX: Time-Accurate Speech Transcription of Long-Form Audio](https://arxiv.org/html/2303.00747v2), version 2, July 11, 2023; first submitted March 1, 2023 ([version history](https://arxiv.org/abs/2303.00747)).

Sections 2–3 separate speech detection, cut-and-merge, recognition and forced alignment. Low-activity cuts avoid arbitrary speech boundaries; merging short segments restores useful context, with a 30-second ceiling. Recognition uses independent inputs without previous-text conditioning or timestamp-token decoding. A separate phoneme model aligns recognized words afterward.

The reported default is pyannote VAD (onset 0.767, offset 0.377, minimum on/off 0.136/0.067 seconds), Whisper large-v2 with greedy decoding, and wav2vec2 BASE_960H alignment. The comparison uses official Whisper v20230307 and an NVIDIA A40. TED-LIUM/Kincaid46 assess recognition; AMI/Switchboard assess timed words. Table 3 compares full audio and 15/30-second VAD cut-and-merge, at batch sizes 1 and 32.

That is not this application's hour-sized API upload. Hosted provider internals are unobserved. Neither the paper's speedup nor its model settings transfer to Groq turbo or OpenAI whisper-1. Forced alignment positions a transcript; it does not establish that its words were spoken. Current WhisperX package behavior is not assumed identical to the 2023 study.

## Verified application baseline

Read November 7, 2026 at main commit [`474bc0b99c6f6f4da90be896ee1a12bad8bb08fa`](https://github.com/byronwall/visual-notes/commit/474bc0b99c6f6f4da90be896ee1a12bad8bb08fa), the merged #297 change. Merge is verified; deployment is not.

| Current owner | Observed behavior | Research implication |
| --- | --- | --- |
| [`doc-audio-encode.ts`](https://github.com/byronwall/visual-notes/blob/474bc0b99c6f6f4da90be896ee1a12bad8bb08fa/app/src/server/notes/doc-audio-encode.ts) | ffmpeg encodes mono 16 kHz Opus at 24 kbps, requests 3,600-second pieces, resets local timestamps and reads actual starts from its CSV. Temporary files are cleaned up. | Distinguish byte transport limits, codec effects and acoustic boundaries. Use measured offsets, not piece index times 3,600. Lossy encoding is not an acoustic-equivalence guarantee. |
| [`doc-audio-transcribe.ts`, lines 24–113](https://github.com/byronwall/visual-notes/blob/474bc0b99c6f6f4da90be896ee1a12bad8bb08fa/app/src/server/notes/doc-audio-transcribe.ts#L24-L113) | Groq `whisper-large-v3-turbo` is selected when its key exists; otherwise OpenAI `whisper-1`. Each piece is awaited sequentially. Every request sends `verbose_json`, segment timestamps and the same vocabulary prompt. | No preceding-piece transcript is supplied by the app. This does not reveal conditioning inside the hosted service. Keep provider/model/prompt constant within each comparison. |
| Same file, lines 91–113 and 248–279 | Local segment starts/ends receive the piece offset. Trimmed raw texts are joined with a space. The combined timestamped segments feed one analysis pass, and raw text, segments and analysis are stored. | There is no app-level overlap or text deduplication in this join. Score raw recognition before the analysis pass can obscure errors. |
| [`doc-audio.shared.ts`](https://github.com/byronwall/visual-notes/blob/474bc0b99c6f6f4da90be896ee1a12bad8bb08fa/app/src/services/doc-audio/doc-audio.shared.ts) and [`DocAudioTasks.tsx`](https://github.com/byronwall/visual-notes/blob/474bc0b99c6f6f4da90be896ee1a12bad8bb08fa/app/src/components/doc-audio/DocAudioTasks.tsx) | Raw segments are grouped under analysis sections; task excerpts map back to a segment time for playback. | Preserve source-clock navigation. Provider segment times are not independently verified word times. |
| [`doc-audio-transcribe.test.ts`](https://github.com/byronwall/visual-notes/blob/474bc0b99c6f6f4da90be896ee1a12bad8bb08fa/app/src/server/notes/doc-audio-transcribe.test.ts) | Mocks the encoder and checks that deleting a recording mid-job does not stop the queue. | This test does not measure seam recognition, actual ffmpeg offsets or provider timestamp accuracy. |

#297 reports a real 75-minute synthetic speech-loop encoding probe, and a real OpenAI transcription of an encoded piece. Those are existing author-reported checks, not reruns here or an end-to-end multi-piece acoustic comparison. A sub-hour memo normally has no application-created internal upload seam; it still has provider-internal recognition windows that this study cannot inspect.

## Existing ownership and duplication check

- [#247](https://github.com/byronwall/visual-notes/pull/247) owns the transcription pipeline; [#258](https://github.com/byronwall/visual-notes/pull/258) owns Summary/Raw and timestamp mapping; [#261](https://github.com/byronwall/visual-notes/pull/261) owns transcript-panel polish and Retry. Preserve them.
- Open draft [#212](https://github.com/byronwall/visual-notes/pull/212) owns request and derived-work lifetime. This proposal does not reopen scheduling, durability, cancellation or embedding recovery.
- The [reading history](https://chatgpt.com/space/page_e751f371f7c4819182252eb79d88810b) records October 27's `visual-notes.acoustic-evidence-versus-recognition.v1`, based on Careless Whisper. That concerns whether text is supported by sound. Here the new variable is where independently submitted audio pieces meet, with source-clock continuity as a separate invariant. Hallucination is a guardrail, not the novelty claim.
- Open/closed PR searches for transcription, Whisper, research and this stable topic, current research paths, and daily-brief branches found no existing seam protocol. #212 was the only open PR at inspection. Search evidence is bounded to this inspection, not a promise that future work cannot overlap.

## Small validation protocol

Use only synthetic or rights-cleared recordings with manually checked transcripts and source times. No personal recordings, production writes, paid API calls, model downloads or dependency additions are part of this documentation PR. A later operator must choose an authorized execution environment, provider and spending cap before running it.

### 1. Prove the source-clock bookkeeping separately

In an isolated test harness, model two provider responses with offsets `0` and `3600.02`, including a segment beginning at local `0.1`. Its expected global start is `3600.12`, not `3600.1`. Check raw-text order, both start/end additions, finite ordered times, cleanup on a rejected second response and exact preservation of each response's text. Record overlapping returned intervals rather than silently repairing them. This is a deterministic contract test, not an ASR quality result. Do not modify the application in this PR.

### 2. Screen boundary sensitivity with short paired clips

Prepare six 60–90-second clips: fluent speech through a nominal seam; a pause at it; a quiet utterance; a repeated phrase across it; a proper noun plus negation and self-correction; and silence followed by speech. Use varied wording, not a loop that makes repetition impossible to interpret. Annotate words and times within five seconds of the fixed seams and every candidate seam, plus speech/silence intervals throughout.

Compare the same waveform in three arms: **U**, one uncut upload; **F**, fixed 30-second upload pieces; **V**, VAD-guided pieces capped at 30 seconds. For V, pin a VAD implementation/version, model checksum and thresholds; retain original contiguous audio intervals and all samples, choose low-activity cuts before the cap and merge adjacent short intervals where they fit. If no safe cut exists, use the fixed cap and record the fallback. This is a boundary-placement adaptation, not a claim to reproduce WhisperX's full preprocessing or benchmark.

Keep codec settings, provider, vocabulary and request options identical. Encode the source once for all arms where practical; record any unavoidable codec packet-boundary differences. Use actual cut offsets and run arms interleaved. Start with one run; repeat discordant cases before drawing a conclusion. Do not send preceding recognized text as prompt context or add overlap in this first comparison. The 30-second split intentionally stresses seams cheaply; it is **not** the production baseline and cannot estimate the frequency of hour-seam failures.

### 3. Validate the actual hour boundary only if the screen helps

Use two rights-cleared recordings longer than an hour: one with speech crossing the hour and one with a nearby pause. Compare the unchanged #297 encoder/request path against a proposed VAD-guided upload cut in the final 15 seconds before each 3,600-second cap. Preserve every sample, choose a suitable pause when available and fall back to the current cut otherwise. Do not concatenate separated speech regions or delete silence: that would require a more complex time map and introduce another variable. Verify actual encoded byte sizes and offset manifests. Keep the uncut reference only where the same provider's current upload limit permits it; never remove the size guard to obtain one.

These two recordings test transfer to the actual upload regime, not a representative error rate. Evaluate providers separately; a positive OpenAI result is not a Groq result. The encoder's lossy format is held constant here, so this experiment does not establish that re-encoding itself is harmless.

### Measurements and stop rules

| Question | Record and compare |
| --- | --- |
| Does a seam lose or invent content? | Align each full raw hypothesis to the manual reference first. Report substitutions, deletions and insertions in the union of the predeclared ±5-second windows around F and V seams, and whole-clip WER. Assign each event once, including insertions at a window edge. Show per-clip counts and denominator, not only a pooled percentage. |
| Does it create false speech or repetition? | Count insertions and repeated five-word sequences, then listen to each flagged span. Genuine repeated speech is not an error. For silence, report unsupported words/events and duration rather than WER with a zero-word denominator. |
| Are playback times still useful? | Report global segment start/end error against annotated corresponding utterance boundaries, invalid/reversed intervals, gaps/overlaps and audible seek position around each seam. Use the same segment-level matching rule for all arms. Do not compare these directly with the paper's word-alignment scores. |
| Is any apparent improvement affordable? | Record request count, input seconds, bytes, encoding/VAD time, API elapsed time, errors/retries and actual charge if available. Separate local CPU cost from network/provider latency. No speedup claim without a matched measurement. |

If word timing later becomes the question, apply the same independently pinned forced aligner to every arm as a separate analysis and compare exact matched words against manual times using a predeclared 200 ms collar. Keep recognition errors and alignment failures visible; forced alignment is not a truth oracle.

Do not recommend implementation from a better average alone. Require fewer adjudicated seam errors without extra lost quiet speech, unsupported text or time-map errors, and show every regression. On this small sample, treat improvements as hypotheses requiring a broader corpus. If VAD misses speech, offsets cannot be reconstructed, costs rise materially or the hour-boundary benefit fails to reproduce, retain the current path and document the negative result. Do not infer a new queue, provider or GPU deployment requirement.

## Design decisions and tradeoffs

The first experiment moves boundaries while preserving the original clock. An overlap arm would introduce duplicate reconciliation; a previous-text prompt arm could propagate an earlier mistake; full WhisperX adoption would change recognition, alignment, hardware and deployment simultaneously. Those are separate later hypotheses, not ingredients needed to test this one. Fixed hour-sized uploads preserve much more app-level context than small clips, so a 30-second win may disappear at an hour.

## Major changes delivered

One research Markdown file: source synthesis, a pinned code baseline, prior-work boundaries and a staged validation protocol. No application, test, dependency, workflow, database or configuration changes. No implementation result is claimed.

## Problems encountered and resolutions

The paper and application use different meanings of chunk size. The protocol resolves that mismatch by labeling the short-clip screen separately from the actual hour-upload comparison. Provider internals remain unknown; the document makes only application-level claims. No acoustic defect was reproduced and no experiment result was fabricated to fill that gap.

## Verification and validation

- Inspected the source paper/version history, pinned encoder/transcriber/tests/shared types, repository `AGENTS.md`, CI workflows, prior research convention and related PRs on November 7, 2026.
- Checked metadata, source links and a one-file documentation diff. Remote-head/diff, labels and CI status are reported in the PR rather than embedding changing CI results here.
- No ASR/VAD experiment, paid provider call, application test suite, local build or browser check was run for this documentation-only change. CI passing, if it does, will not validate the proposed audio experiment.

## Process improvements

Keep an experiment manifest with source hash/license, exact cut intervals, encoded sizes, VAD/model versions, provider options, raw responses and reference annotation version. The future experiment owner should add it beside results, so a timestamp or quality change can be traced to one variable rather than an unnamed library default. Keep raw audio and transcripts outside this public repository unless publication is explicitly authorized.

## Agent and skill improvements

None applied to repository instructions or skills. For a future experiment's checklist, require an explicit distinction between upload pieces, provider/model windows and playback timestamps before interpreting results; the experiment owner should keep that rule in its protocol. No general agent behavior change is needed for this documentation PR.

## Follow-ups and open risks

1. Select an authorized operator, rights-cleared fixtures, VAD version and provider budget. Recheck current code and competing PRs before starting.
2. Run bookkeeping first, the small paired screen second, and actual hour-sized comparison only if justified. Return raw per-case evidence and negative findings as well as averages.
3. Decide whether a separate, narrowly scoped implementation proposal is warranted. Preserve #297 and existing UI/lifecycle owners; do not implement or merge from this research alone.
