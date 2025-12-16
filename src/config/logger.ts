import pino from 'pino';
import { settings } from './env.js';

export const logger = pino({
  level: settings.nodeEnv === 'production' ? 'info' : 'debug',
  transport:
    settings.nodeEnv === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard'
          }
        }
});
