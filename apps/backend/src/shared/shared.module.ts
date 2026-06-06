import { Module, Global } from '@nestjs/common';

/**
 * Fornece conexões com MongoDB e Redis para toda a aplicação.
 * Marcado como @Global para que os providers não precisem ser reimportados em cada módulo.
 * As conexões reais serão configuradas na Fase 2 (infra) e Fase 3 (esqueleto).
 */
@Global()
@Module({
  providers: [],
  exports: [],
})
export class SharedModule {}
