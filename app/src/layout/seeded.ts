import { hashString, mulberry32 } from "~/utils/hash";

export function seededPositionFor(
  title: string,
  index: number,
  spread: number
): { x: number; y: number } {
  const base = `${title}\u0000${index}`;
  const seed = hashString(base);
  const rnd = mulberry32(seed);
  const angle = rnd() * Math.PI * 2;
  const radius = Math.sqrt(rnd());
  const x = Math.cos(angle) * radius * spread;
  const y = Math.sin(angle) * radius * spread;
  return { x, y };
}
