/**
 * Structured logging with pino - simplified
 */

import pino, { type Logger as PinoLogger } from 'pino';

export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  child(bindings: Record<string, unknown>): Logger;
}

// Cast pino to any to avoid overload issues
const pinoInstance: any = pino;

export function createLogger(level: string = 'info'): Logger {
  const logger = pinoInstance({
    level,
    transport: process.env.NODE_ENV !== 'production' ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    } : undefined,
    formatters: {
      bindings: (bindings: Record<string, unknown>) => ({
        service: 'ika-tensei-relayer',
        ...bindings,
      }),
    },
    timestamp: pinoInstance.stdTimeFunctions.isoTime,
  });

  return {
    info: (msg: string, ...args: unknown[]) => args.length ? logger.info(msg, args) : logger.info(msg),
    warn: (msg: string, ...args: unknown[]) => args.length ? logger.warn(msg, args) : logger.warn(msg),
    error: (msg: string, ...args: unknown[]) => args.length ? logger.error(msg, args) : logger.error(msg),
    debug: (msg: string, ...args: unknown[]) => args.length ? logger.debug(msg, args) : logger.debug(msg),
    child: (bindings: Record<string, unknown>) => {
      const child = logger.child(bindings);
      return {
        info: (msg: string, ...args: unknown[]) => args.length ? child.info(msg, args) : child.info(msg),
        warn: (msg: string, ...args: unknown[]) => args.length ? child.warn(msg, args) : child.warn(msg),
        error: (msg: string, ...args: unknown[]) => args.length ? child.error(msg, args) : child.error(msg),
        debug: (msg: string, ...args: unknown[]) => args.length ? child.debug(msg, args) : child.debug(msg),
        child: (b: Record<string, unknown>) => createLogger(level).child({ ...bindings, ...b }),
      };
    },
  };
}

// Default logger instance
export const logger = createLogger(process.env.LOG_LEVEL || 'info');
