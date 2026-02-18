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

/**
 * M4: Sanitize sensitive data for logging
 */
export function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'privateKey',
    'secretKey',
    'keypair',
    'keypairBytes',
    'signature',
    'dwallet_pubkey',
    'dwalletPubkey',
    'encryptedShare',
    'encrypted_share',
    'attestation',
    'key',
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'apiKey',
    'apikey',
  ];

  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sk => lowerKey.includes(sk.toLowerCase()));
    
    if (isSensitive) {
      if (typeof value === 'string' && value.length > 16) {
        sanitized[key] = value.slice(0, 16) + '...';
      } else if (typeof value === 'string') {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = '[REDACTED]';
      }
    } else if (typeof value === 'string' && value.length === 64) {
      // Truncate 32-byte hex strings (like seal_hash)
      sanitized[key] = value.slice(0, 16) + '...';
    } else if (ArrayBuffer.isView(value) || value instanceof Uint8Array) {
      sanitized[key] = '[BINARY_DATA]';
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}
