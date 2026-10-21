/** Number of recent level samples kept for the bar display. */
export const LEVEL_HISTORY = 24;
const SAMPLE_INTERVAL_MS = 90;

/**
 * Samples the microphone loudness (0..1) for the live meter. Uses
 * requestAnimationFrame, so it costs nothing while the screen is locked.
 */
export function startLevelMeter(
  context: AudioContext,
  stream: MediaStream,
  onLevels: (levels: number[]) => void,
) {
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  const history: number[] = Array.from({ length: LEVEL_HISTORY }, () => 0);
  let lastSample = 0;
  let frame = 0;

  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    if (now - lastSample < SAMPLE_INTERVAL_MS) return;
    lastSample = now;
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const s of samples) sum += s * s;
    const rms = Math.sqrt(sum / samples.length);
    // Speech RMS sits around 0.01–0.2; a log scale spreads it across 0..1.
    const level = Math.max(
      0,
      Math.min(1, (Math.log10(rms + 1e-4) + 3.2) / 2.6),
    );
    history.shift();
    history.push(level);
    onLevels([...history]);
  };
  frame = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(frame);
    source.disconnect();
  };
}
