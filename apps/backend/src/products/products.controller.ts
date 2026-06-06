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
    summary: 'List all products',
    description: 'Returns the product catalogue sorted by name.',
  })
  @ApiOkResponse({
    type: [ProductResponseDto],
    description: 'List of available products.',
  })
  findAll() {
    return this.productsService.findAll();
  }
}
