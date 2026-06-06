import { Module } from '@nestjs/common';
import { FakeErpService } from './fake-erp.service';

@Module({
  providers: [FakeErpService],
  exports: [FakeErpService],
})
export class ErpModule {}
