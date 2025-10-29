import { hashString } from "~/utils/hash";

export function colorFor(title: string): string {
  const h = hashString(title);
  const hue = h % 360;
  const sat = 55 + (h % 20); // 55–74
  const light = 55; // fixed for readability
  return `hsl(${hue} ${sat}% ${light}%)`;
}
