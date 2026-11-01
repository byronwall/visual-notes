const ACTIVITY_LABELS: Record<string, string> = {
  READ_HEAVY: "Read-heavy",
  EDIT_HEAVY: "Edit-heavy",
  BALANCED: "Balanced",
  COLD: "Cold",
};

export const activityLabel = (value: string) =>
  ACTIVITY_LABELS[value] ?? value;

/** Fixed order, so these rows stay put as other filters change the counts. */
export const orderActivity = <T extends { value: string }>(items: T[]) => {
  const order = Object.keys(ACTIVITY_LABELS);
  return [...items].sort(
    (a, b) => order.indexOf(a.value) - order.indexOf(b.value),
  );
};

export const updatedLabel = (days: number) =>
  days === 1 ? "Last 24 hours" : `Last ${days} days`;
