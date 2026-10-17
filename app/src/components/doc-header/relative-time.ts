/** Compact relative label such as `just now`, `5m ago`, or `3d ago`. */
export function formatRelativeShort(nowMs: number, iso: string): string {
  const target = Date.parse(iso);
  if (!Number.isFinite(target)) return "";
  const seconds = Math.max(0, Math.floor((nowMs - target) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
