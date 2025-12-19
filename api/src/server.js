import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { env } from './config/env.js';
import { loggerMiddleware } from './middlewares/logger.js';
import { notFound, errorHandler } from './middlewares/error.js';
import { healthRouter } from './routes/health.js';
import productsRouter from './routes/products.js';
import campaignsRouter from './routes/campaigns.js';
import opexRouter from './routes/opex.js';
import scenariosRouter from './routes/scenarios.js';
import settingsRouter from './routes/settings.js';
import exportsRouter from './routes/exports.js';

const app = express();

// Core middleware
app.use(loggerMiddleware);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/health', healthRouter);
app.use('/products', productsRouter);
app.use('/campaigns', campaignsRouter);
app.use('/', opexRouter);
app.use('/scenarios', scenariosRouter);
app.use('/', settingsRouter);
app.use('/', exportsRouter);

// TODO: add protected routes using requireAuth middleware once business logic is implemented

// Fallbacks
app.use(notFound);
app.use(errorHandler);

const port = env.PORT || 4000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on port ${port}`);
});
