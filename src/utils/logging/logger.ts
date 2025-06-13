import pino from 'pino';
import { BaseError } from '../../errors/index.js';

/**
 * Logger configuration interface
 */
export interface LoggerConfig {
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  environment?: 'development' | 'production' | 'test';
  enablePrettyPrint?: boolean;
  logFile?: string;
}

/**
 * Create a configured logger instance
 */
export function createLogger(config: LoggerConfig = {}): pino.Logger {
  const {
    level = 'info',
    environment = process.env.NODE_ENV as 'development' | 'production' | 'test' || 'development',
    enablePrettyPrint = environment === 'development',
    logFile
  } = config;

  const pinoConfig: pino.LoggerOptions = {
    level,
    name: 'mcp-epub-rag',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
      error: (error) => {
        if (error instanceof BaseError) {
          return {
            name: error.name,
            message: error.message,
            errorCode: error.errorCode,
            severity: error.severity,
            context: error.context,
            stack: error.stack
          };
        }
        return pino.stdSerializers.err(error);
      }
    }
  };

  // Pretty print for development
  if (enablePrettyPrint && environment !== 'production') {
    pinoConfig.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    };
  }

  // File logging
  if (logFile) {
    pinoConfig.transport = {
      targets: [
        {
          target: 'pino/file',
          options: { destination: logFile }
        },
        ...(enablePrettyPrint ? [{
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }] : [])
      ]
    };
  }

  return pino(pinoConfig);
}

/**
 * Default logger instance
 */
export const logger = createLogger();

/**
 * Performance tracking utility
 */
export class PerformanceTracker {
  private startTime: bigint;
  private logger: pino.Logger;
  private operation: string;

  constructor(operation: string, logger: pino.Logger) {
    this.operation = operation;
    this.logger = logger;
    this.startTime = process.hrtime.bigint();
    this.logger.debug(`Starting operation: ${operation}`);
  }

  finish(additionalData?: Record<string, unknown>): void {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - this.startTime) / 1_000_000;
    
    this.logger.info({
      operation: this.operation,
      durationMs: Math.round(durationMs * 100) / 100,
      ...additionalData
    }, `Completed operation: ${this.operation}`);
  }

  finishWithError(error: Error, additionalData?: Record<string, unknown>): void {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - this.startTime) / 1_000_000;
    
    this.logger.error({
      operation: this.operation,
      durationMs: Math.round(durationMs * 100) / 100,
      error,
      ...additionalData
    }, `Failed operation: ${this.operation}`);
  }
}

/**
 * Create a performance tracker
 */
export function trackPerformance(operation: string, customLogger?: pino.Logger): PerformanceTracker {
  return new PerformanceTracker(operation, customLogger || logger);
}
