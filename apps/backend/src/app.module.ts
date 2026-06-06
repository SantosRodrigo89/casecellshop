import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { ErpModule } from './erp/erp.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    SharedModule,
    HealthModule,
    ProductsModule,
    OrdersModule,
    ErpModule,
  ],
})
export class AppModule {}
