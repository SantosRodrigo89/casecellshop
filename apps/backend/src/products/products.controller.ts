import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { ProductResponseDto } from './dto/product-response.dto';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista todos os produtos',
    description: 'Retorna a vitrine de produtos ordenada por nome.',
  })
  @ApiOkResponse({
    type: [ProductResponseDto],
    description: 'Lista de produtos disponíveis.',
  })
  findAll() {
    return this.productsService.findAll();
  }
}
