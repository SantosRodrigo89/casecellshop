import { Provider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Provider da conexão ioredis, injetável via token REDIS_CLIENT.
 * Exportado pelo SharedModule (global) para uso no healthcheck e, futuramente,
 * no cache da vitrine (Fase 10).
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
