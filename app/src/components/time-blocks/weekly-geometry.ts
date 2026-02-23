import { addDays, startOfDay } from "./date-utils";

export const getGridHeightPx = (startHour: number, endHour: number, hourHeight: number) =>
  Math.max(0, (endHour - startHour) * hourHeight);

export const getDayIndexInRange = (date: Date, weekStart: Date, numberOfDays: number) => {
  const diffMs = startOfDay(date).getTime() - startOfDay(weekStart).getTime();
  const index = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (index < 0 || index >= numberOfDays) return null;
  return index;
};

export const toGridY = (
  date: Date,
  startHour: number,
  endHour: number,
  hourHeight: number
) => {
  const totalMinutes = (endHour - startHour) * 60;
  if (totalMinutes <= 0) return 0;
  const heightPx = getGridHeightPx(startHour, endHour, hourHeight);
  const minutes = date.getHours() * 60 + date.getMinutes();
  const normalized = minutes - startHour * 60;
  const raw = (normalized / totalMinutes) * heightPx;
  return Math.max(0, Math.min(heightPx, raw));
};

export const getVisibleSegmentForDay = (
  start: Date,
  end: Date,
  dayIndex: number,
  weekStart: Date,
  startHour: number,
  endHour: number
) => {
  const day = addDays(weekStart, dayIndex);
  const dayStart = new Date(day);
  dayStart.setHours(startHour, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(endHour, 0, 0, 0);

  if (end.getTime() <= dayStart.getTime() || start.getTime() >= dayEnd.getTime()) {
    return null;
  }

  return {
    visibleStart: new Date(Math.max(start.getTime(), dayStart.getTime())),
    visibleEnd: new Date(Math.min(end.getTime(), dayEnd.getTime())),
  };
};
