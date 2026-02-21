import { createSignal } from "solid-js";

export type ConsoleCaptureLevel =
  | "log"
  | "info"
  | "warn"
  | "error"
  | "debug"
  | "trace"
  | "table";

export type ConsoleCaptureEntry = {
  id: number;
  level: ConsoleCaptureLevel;
  timestamp: number;
  prefix: string | null;
  summary: string;
  details: string;
  args: unknown[];
};

const STORAGE_KEY = "visual-notes.console-capture.enabled";
const DEFAULT_MAX_ENTRIES = 1000;
const PREFIX_RE = /^\s*\[([^\]]+)\]/;
const METHODS: ConsoleCaptureLevel[] = [
  "log",
  "info",
  "warn",
  "error",
  "debug",
  "trace",
  "table",
];

const [entries, setEntries] = createSignal<ConsoleCaptureEntry[]>([]);
const [enabled, setEnabled] = createSignal(false);
const [maxEntries, setMaxEntries] = createSignal(DEFAULT_MAX_ENTRIES);

let nextId = 1;
let patched = false;
let originals: Partial<Record<ConsoleCaptureLevel, (...args: any[]) => void>> = {};

const safeReadEnabledFromStorage = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const safeWriteEnabledToStorage = (next: boolean) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // Storage can be unavailable in privacy contexts; fail soft.
  }
};

const formatError = (value: Error) => {
  if (value.stack) return value.stack;
  return `${value.name}: ${value.message}`;
};

const safeJsonStringify = (value: unknown, pretty: boolean, maxLen: number) => {
  const seen = new WeakSet<object>();
  const out = JSON.stringify(
    value,
    (_key, item) => {
      if (typeof item === "bigint") return `${item.toString()}n`;
      if (item instanceof Error) {
        return {
          name: item.name,
          message: item.message,
          stack: item.stack,
        };
      }
      if (typeof item === "function") return `[Function ${item.name || "anonymous"}]`;
      if (typeof item === "symbol") return item.toString();
      if (item && typeof item === "object") {
        if (seen.has(item)) return "[Circular]";
        seen.add(item);
      }
      return item;
    },
    pretty ? 2 : 0,
  );
  if (!out) return String(value);
  return out.length > maxLen ? `${out.slice(0, maxLen)}…` : out;
};

const formatValue = (value: unknown, pretty: boolean) => {
  if (typeof value === "string") return value;
  if (value instanceof Error) return formatError(value);
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "undefined" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  try {
    return safeJsonStringify(value, pretty, pretty ? 20_000 : 2_000);
  } catch {
    return String(value);
  }
};

const normalizeForJson = (value: unknown, seen: WeakSet<object>, depth: number): unknown => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "undefined") return "[undefined]";
  if (typeof value === "bigint") return `${value.toString()}n`;
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (depth >= 6) return "[MaxDepth]";
  if (!value || typeof value !== "object") return String(value);
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => normalizeForJson(item, seen, depth + 1));
  }

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const keys = Object.keys(obj).slice(0, 100);
  for (const key of keys) {
    out[key] = normalizeForJson(obj[key], seen, depth + 1);
  }
  return out;
};

const buildStructuredArgs = (args: unknown[]) => {
  const seen = new WeakSet<object>();
  return args.map((arg) => normalizeForJson(arg, seen, 0));
};

const detectPrefix = (args: unknown[]) => {
  const first = args[0];
  if (typeof first !== "string") return null;
  const match = first.match(PREFIX_RE);
  if (!match?.[1]) return null;
  return match[1].trim().toLowerCase();
};

const buildSummary = (args: unknown[]) => {
  const text = args
    .map((value) => formatValue(value, false))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "(empty log)";
  return text;
};

const buildDetails = (args: unknown[]) => {
  if (args.length === 0) return "(no arguments)";
  return args
    .map((value, idx) => `[${idx}] ${formatValue(value, true)}`)
    .join("\n\n");
};

const pushEntry = (level: ConsoleCaptureLevel, args: unknown[]) => {
  const max = maxEntries();
  const entry: ConsoleCaptureEntry = {
    id: nextId++,
    level,
    timestamp: Date.now(),
    prefix: detectPrefix(args),
    summary: buildSummary(args),
    details: buildDetails(args),
    args: buildStructuredArgs(args),
  };
  setEntries((prev) => {
    const next = [entry, ...prev];
    if (next.length > max) next.length = max;
    return next;
  });
};

const createPatchedConsoleMethod = (
  level: ConsoleCaptureLevel,
  original: (...args: any[]) => void,
) => {
  return (...args: unknown[]) => {
    pushEntry(level, args);
    original(...args);
  };
};

const patchConsole = () => {
  if (typeof window === "undefined" || patched) return;
  originals = {};
  for (const level of METHODS) {
    const raw = window.console[level];
    if (typeof raw !== "function") continue;
    const original = raw.bind(window.console) as (...args: any[]) => void;
    originals[level] = original;
    window.console[level] = createPatchedConsoleMethod(level, original);
  }
  patched = true;
};

const unpatchConsole = () => {
  if (typeof window === "undefined" || !patched) return;
  for (const level of METHODS) {
    const original = originals[level];
    if (original) window.console[level] = original;
  }
  originals = {};
  patched = false;
};

export const initializeConsoleLogCapture = () => {
  const nextEnabled = safeReadEnabledFromStorage();
  setEnabled(nextEnabled);
  if (nextEnabled) patchConsole();
  if (!nextEnabled) unpatchConsole();
};

export const setConsoleLogCaptureEnabled = (nextEnabled: boolean) => {
  setEnabled(nextEnabled);
  safeWriteEnabledToStorage(nextEnabled);
  if (nextEnabled) patchConsole();
  if (!nextEnabled) unpatchConsole();
};

export const clearConsoleLogEntries = () => {
  setEntries([]);
};

export const setConsoleLogCaptureMaxEntries = (nextMax: number) => {
  const parsed = Number.isFinite(nextMax) ? Math.trunc(nextMax) : DEFAULT_MAX_ENTRIES;
  const safe = Math.max(1, Math.min(parsed, 10_000));
  setMaxEntries(safe);
  setEntries((prev) => (prev.length > safe ? prev.slice(0, safe) : prev));
};

export const consoleLogCaptureEnabled = enabled;
export const consoleLogEntries = entries;
export const consoleLogCaptureMaxEntries = maxEntries;
