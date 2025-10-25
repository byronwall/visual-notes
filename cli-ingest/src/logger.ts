import consola from "consola";

export const createLogger = (verbose: boolean) => {
  const logger = consola.create({ level: verbose ? 4 : 3 });
  return {
    info: (...a: any[]) => (logger as any).info(...a),
    warn: (...a: any[]) => (logger as any).warn(...a),
    error: (...a: any[]) => (logger as any).error(...a),
  };
};
