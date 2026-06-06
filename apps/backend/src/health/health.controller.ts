import { Controller, Get } from '@nestjs/common';

/**
 * Healthcheck básico da aplicação.
 * Na Fase 3 será expandido para pingar MongoDB e Redis via @nestjs/terminus.
 */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
