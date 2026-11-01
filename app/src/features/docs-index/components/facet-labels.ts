const ACTIVITY_LABELS: Record<string, string> = {
  READ_HEAVY: "Read-heavy",
  EDIT_HEAVY: "Edit-heavy",
  BALANCED: "Balanced",
  COLD: "Cold",
};

export const activityLabel = (value: string) =>
  ACTIVITY_LABELS[value] ?? value;

export const updatedLabel = (days: number) =>
  days === 1 ? "Last 24 hours" : `Last ${days} days`;
