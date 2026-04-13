import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { authMiddleware } from './middleware/auth';
import { apiRateLimiter } from './middleware/rateLimiter';
import { httpLogger } from './middleware/logger';
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler';
import { connectDB, disconnectDB } from './services/db';
import { logger } from './middleware/logger';

// Routes
import authRouter from './routes/auth';
import projectsRouter from './routes/projects';
import documentsRouter from './routes/documents';
import integrationsRouter from './routes/integrations';
import settingsRouter from './routes/settings';

// OpenAPI spec (inline for now — extend in production)
import openApiSpec from './openapi.json';

const app = express();
const PORT = process.env.PORT ?? 3001;

// ─── Security & middleware ────────────────────────────────────────────────────

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(httpLogger);

// Health check (no auth)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

// ─── Routes ───────────────────────────────────────────────────────────────────

// Auth (no rate limiting on login/register — has its own protections)
app.use('/api/auth', authRouter);

// Protected routes
app.use('/api', apiRateLimiter, authMiddleware);
app.use('/api/projects', projectsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/settings', settingsRouter);

// ─── Error handling ───────────────────────────────────────────────────────────

app.use(notFoundHandler);
app.use(globalErrorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  await connectDB();

  const server = app.listen(PORT, () => {
    logger.info(`🚀 ProductOS server running on http://localhost:${PORT}`);
    logger.info(`📚 API docs: http://localhost:${PORT}/api/docs`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV ?? 'development'}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await disconnectDB();
      logger.info('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});

export default app;
