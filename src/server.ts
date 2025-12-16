import mongoose from 'mongoose';
import { app } from './app.js';
import { settings } from './config/env.js';
import { logger } from './config/logger.js';
import { categoryService } from './services/category.service.js';

let server: import('http').Server | undefined;

const start = async () => {
  try {
    await mongoose.connect(settings.mongoUri);
    logger.info('Connected to MongoDB');

    // Seed default categories if needed
    await categoryService.seedDefaults();

    server = app.listen(settings.port, () => {
      logger.info(`SUPER-VIDEOTHEQUE API ready on port ${settings.port}`);
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};

start();

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutting down gracefully');
  server?.close();
  try {
    await mongoose.connection.close();
    logger.info('Mongo connection closed');
  } catch (error) {
    logger.error({ err: error }, 'Error closing Mongo connection');
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
  shutdown('unhandledRejection');
});
