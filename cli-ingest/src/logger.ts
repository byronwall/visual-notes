import consola from "consola";

export type Logger = {
  info: (...a: any[]) => void;
  warn: (...a: any[]) => void;
  error: (...a: any[]) => void;
};

export function createLogger(verbose: boolean): Logger {
  const logger = consola.create({ level: verbose ? 4 : 3 });
  return {
    info: (...a: any[]) => (logger as any).info(...a),
    warn: (...a: any[]) => (logger as any).warn(...a),
    error: (...a: any[]) => (logger as any).error(...a),
  };
}
