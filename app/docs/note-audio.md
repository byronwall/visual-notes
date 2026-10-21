# Note audio recordings

A note can hold any number of audio recordings (`DocAudio` rows). They sit in
a strip above the note body, outside `Doc.content`, so a later transcript can
pair with its recording without touching the block schema.

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
