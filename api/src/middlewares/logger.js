import pino from 'pino';
import pinoHttp from 'pino-http';

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

export const logger = baseLogger;
export const loggerMiddleware = pinoHttp({ logger: baseLogger });
