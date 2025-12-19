import { logger } from './logger.js';

// Not-found handler
export const notFound = (req, res, _next) => {
  res.status(404).json({ error: 'Not found' });
};

// Centralized error handler
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  logger.error({ err }, 'Unhandled error');

  if (res.headersSent) {
    return res.end();
  }

  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  return res.status(status).json({ error: message });
};
