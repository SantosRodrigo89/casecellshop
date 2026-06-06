import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { LoggerModule } from 'nestjs-pino';
import { envConfig } from '../config/env.config';
import { validateEnv } from '../config/env.validation';
import { RedisProvider } from './redis.provider';

/**
 * Global infrastructure hub.
 * Centralises ConfigModule, MongoDB (Mongoose), structured logger (pino) and
 * the Redis provider (ioredis). Marked @Global so domain modules can inject
 * these dependencies without re-importing this module.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [envConfig],
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level:
            config.get<string>('nodeEnv') === 'production' ? 'info' : 'debug',
          autoLogging: true,
        },
      }),
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongoUri'),
      }),
    }),
  ],
  providers: [RedisProvider],
  exports: [RedisProvider, MongooseModule],
})
export class SharedModule {}
