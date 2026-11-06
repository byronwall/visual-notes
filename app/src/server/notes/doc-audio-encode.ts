import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Whisper resamples to 16 kHz mono, so this loses nothing it would use.
// At 24 kbps an hour of speech is ~11 MB, well under the 25 MB upload cap,
// and a memo under an hour stays one piece with no cut through a word.
const SEGMENT_SECONDS = 3600;
const BITRATE = "24k";

export type AudioSegment = { file: string; offset: number };

/**
 * Re-encodes a recording into hour-long Opus pieces in a temp dir. Pass the
 * pieces to Whisper one by one, adding each `offset` to its timestamps, then
 * call `cleanup`.
 */
export async function encodeForTranscription(input: string) {
  const dir = await mkdtemp(path.join(tmpdir(), "doc-audio-"));
  const cleanup = () => rm(dir, { recursive: true, force: true });
  try {
    const list = path.join(dir, "segments.csv");
    // ffmpeg's own name, so a missing binary fails with a clear ENOENT.
    await execFileAsync(
      process.env.FFMPEG_BIN || "ffmpeg",
      [
        ...["-hide_banner", "-loglevel", "error", "-i", input, "-vn"],
        ...["-ac", "1", "-ar", "16000", "-c:a", "libopus", "-b:a", BITRATE],
        ...["-f", "segment", "-segment_time", String(SEGMENT_SECONDS)],
        ...["-reset_timestamps", "1", "-segment_list", list],
        ...["-segment_list_type", "csv", path.join(dir, "part%03d.ogg")],
      ],
      { maxBuffer: 8 * 1024 * 1024 },
    );
    // Each line is `part000.ogg,<start seconds>,<end seconds>`.
    const segments = (await readFile(list, "utf8"))
      .trim()
      .split("\n")
      .map((line): AudioSegment => {
        const [name, start] = line.split(",");
        return { file: path.join(dir, name), offset: Number(start) };
      });
    return { segments, cleanup };
  } catch (err) {
    await cleanup();
    throw err;
  }
}
