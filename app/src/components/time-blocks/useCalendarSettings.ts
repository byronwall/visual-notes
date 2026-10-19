import { createEffect, createSignal } from "solid-js";

const STORAGE_KEY = "time-blocks-calendar-settings-v1";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export type CalendarSettings = ReturnType<typeof useCalendarSettings>;

export const useCalendarSettings = () => {
  const [startHour, setStartHourRaw] = createSignal(6);
  const [endHour, setEndHourRaw] = createSignal(22);
  const [numberOfDays, setNumberOfDaysRaw] = createSignal(7);
  const [snapMinutes, setSnapMinutesRaw] = createSignal(15);
  const [hourHeight, setHourHeightRaw] = createSignal(56);
  const [hydrated, setHydrated] = createSignal(false);

  const setStartHour = (value: number) =>
    setStartHourRaw(
      clamp(Math.round(value || 0), 0, Math.min(23, endHour() - 1)),
    );
  const setEndHour = (value: number) =>
    setEndHourRaw(
      clamp(Math.round(value || 24), Math.max(1, startHour() + 1), 24),
    );
  const setNumberOfDays = (value: number) =>
    setNumberOfDaysRaw(clamp(Math.round(value || 7), 1, 14));
  const setSnapMinutes = (value: number) =>
    setSnapMinutesRaw(clamp(Math.round(value || 15), 5, 60));
  const setHourHeight = (value: number) =>
    setHourHeightRaw(clamp(Math.round(value || 56), 30, 140));

  // Settings live in localStorage, so they can only be read after hydration.
  createEffect(() => {
    if (hydrated()) return;
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem(STORAGE_KEY) ?? "{}",
      ) as Partial<Record<string, number>>;
      const read = (key: string) =>
        Number.isFinite(parsed[key]) ? Number(parsed[key]) : null;
      const start = read("startHour");
      const end = read("endHour");
      if (start !== null && end !== null && start < end) {
        setStartHourRaw(clamp(start, 0, 23));
        setEndHourRaw(clamp(end, 1, 24));
      }
      const days = read("numberOfDays");
      if (days !== null) setNumberOfDays(days);
      const snap = read("snapMinutes");
      if (snap !== null) setSnapMinutes(snap);
      const height = read("hourHeight");
      if (height !== null) setHourHeight(height);
    } catch {
      // Ignore an unreadable payload and keep the defaults.
    }
    setHydrated(true);
  });

  createEffect(() => {
    if (!hydrated()) return;
    const payload = {
      startHour: startHour(),
      endHour: endHour(),
      numberOfDays: numberOfDays(),
      snapMinutes: snapMinutes(),
      hourHeight: hourHeight(),
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage can be unavailable (private mode); settings stay in memory.
    }
  });

  return {
    startHour,
    endHour,
    numberOfDays,
    snapMinutes,
    hourHeight,
    hydrated,
    setStartHour,
    setEndHour,
    setNumberOfDays,
    setSnapMinutes,
    setHourHeight,
  };
};
