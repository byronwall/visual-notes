# Note audio recordings

A note can hold any number of audio recordings (`DocAudio` rows). They sit in
a strip above the note body, outside `Doc.content`, so each transcript pairs
with its recording without touching the block schema.

## Pieces

- Recorder: `src/features/audio-recorder/recorder-store.ts` is one app-wide
  `MediaRecorder`, so recording continues across client-side navigation. The
  floating `RecordingIndicator` shows it when its note is off screen. A full
  page reload ends it (the browser warns first).
- Upload: the recorder emits a chunk every 5s. `chunk-uploader.ts` posts them
  in order to `POST /api/doc-audio/:id/chunks?seq=N&elapsedMs=M` and retries
  with backoff, holding chunks in memory while offline. The server appends
  each chunk to one file and ignores a seq it already has, so a killed tab
  loses at most the unsent chunks.
- Storage: files live in `data/doc-audio/` (`DOC_AUDIO_STORAGE_DIR`
  overrides it). `GET /api/doc-audio/:id` serves them with Range support;
  Safari won't play media without it.
- Status: `recording` until Stop calls `finishDocAudio`, then `ready`. A
  recording left in `recording` (crash, tab killed) is still playable and
  shows as "Interrupted".
- Entry points: the mic button in the note header, plus "Voice note" in the
  sidebar and phone app bar, which creates a note and starts recording from
  one tap.

## Transcripts

- Job: Stop sets `transcriptStatus` to `pending` and queues
  `server/notes/doc-audio-transcribe.ts`. Jobs run one at a time in the app
  process. At boot, `resumeTranscriptions` re-queues `none`/`pending` rows
  that are `ready`, or that have been quiet for 15 minutes (interrupted).
- Speech-to-text: Groq `whisper-large-v3-turbo` when `GROQ_API_KEY` is set
  (100 MB limit), else OpenAI `whisper-1` (25 MB). `TRANSCRIPT_VOCABULARY`
  overrides the spelling prompt of project terms.
- Analysis: one structured call (`TRANSCRIPT_LLM_MODEL`, default
  `gpt-5.4-mini`) ported from voice-to-context's `transcript_plan` prompt,
  plus tasks. It returns title, summary, bullets, themes, timed sections with
  cleaned text, and tasks with excerpts (`TranscriptAnalysis`).
- Derived: `Doc.audioText` (summaries and cleaned text of every transcript)
  feeds keyword search and embeddings. A note still titled `Voice note · …`
  takes the first transcript's title.
- Agents: `notes_get` lists `recordings` with the analysis and cleaned text.
  `notes_get_transcript` returns one recording's cleaned or raw timed text.
- UI: summary, tasks (+ appends a task block, which becomes an Inbox task),
  and sections behind a toggle; a section's time seeks the player. The strip
  polls while a transcript is pending.

## iOS notes

- Use Safari in a normal tab. Home Screen (standalone) web apps lose the
  microphone when the screen locks.
- The recorder prefers `audio/mp4` (the only format iOS records). Timesliced
  fragmented MP4 chunks concatenate into a valid file.
- The sun toggle on the live row holds a screen wake lock, as a fallback for
  when locked-screen capture proves unreliable. The setting is remembered
  per browser.
- Elapsed time is wall-clock, so it keeps counting while the screen is
  locked. The level meter pauses then (it runs on `requestAnimationFrame`).
