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

## Dropped recordings

- Drop audio files (Voice Memos `.m4a`, `.mp3`, `.wav`, …) anywhere on an
  open note. `useDocAudioDrop` catches the drop in the capture phase, ahead
  of the editor, so audio becomes recordings instead of file cards. Other
  files in the same drop still go to the editor as attachments.
- Each file posts its raw bytes to `POST /api/doc-audio?docId=&name=&lastModified=&durationMs=`
  (XHR, for progress), one at a time. The server streams it to disk
  (`writeAudioFile`, 100 MB cap to match Groq) and creates a `ready` row.
- The row's label is the file name without its extension, and `createdAt` is
  the file's modified time, so a stack of memos sorts in recorded order.
  Duration comes from the browser reading the file's metadata.
- Each dropped file queues a transcript like a finished recording. With two
  or more transcripts, "Insert all transcripts" appends them to the note,
  each under a heading with its recording's name.

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
  and sections behind a toggle. The section "cleaned text" is really an LLM
  summary, so a **Summary / Raw** switch shows the Whisper segments under the
  same headings (`segmentsBySection`). Click a raw phrase or a section time
  to seek. The phrase being played is highlighted and kept in view.
  A task shows the time its excerpt was said (`excerptSeconds`, exact match
  on the first five words), and clicking it opens Raw there. Copy and
  Insert use the form that is showing. The strip polls while a transcript
  is pending.
- Move: the row's move button sends a recording, with its transcript, to
  an existing note or a new one (`moveDocAudio`). A new note takes the
  recording's name and the source note's path. Both notes' `audioText` is
  rebuilt.
- Cleanup: a note with recordings always goes to Keep, because the archive
  purge would delete its recordings. The assessment reads `audioText` as part
  of the body, and a finished transcript makes the assessment stale. When
  cleanup archives a note into another note, its recordings move there.

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
