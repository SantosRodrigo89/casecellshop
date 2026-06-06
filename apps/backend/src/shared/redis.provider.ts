import { Provider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * ioredis connection provider, injectable via the REDIS_CLIENT token.
 * Exported by SharedModule (global) for use in the health check and,
 * optionally, the product-list cache (Phase 10).
 */
export const RedisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Redis => {
    const logger = new Logger('RedisProvider');
    const client = new Redis({
      host: config.get<string>('redis.host'),
      port: config.get<number>('redis.port'),
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });

    client.on('error', (err) => logger.error(`Redis error: ${err.message}`));
    client.on('connect', () => logger.log('Redis connected'));

    return client;
  },
};
