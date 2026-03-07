import { hashString } from "~/utils/hash";

export function colorFor(title: string): string {
  const h = hashString(title);
  const hue = h % 360;
  const sat = 52;
  const light = 50;
  return `hsl(${hue} ${sat}% ${light}%)`;
}
