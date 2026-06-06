import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ProductsSeedService } from './products-seed.service';
import { Product } from './schemas/product.schema';
import { PRODUCT_SEEDS } from './products.seed';

describe('ProductsSeedService', () => {
  let service: ProductsSeedService;

  const mockProductModel = {
    countDocuments: jest.fn(),
    insertMany: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Garante que onModuleInit (runSeed) não insira dados durante o setup dos testes
    mockProductModel.countDocuments.mockResolvedValue(1);
    mockProductModel.insertMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsSeedService,
        { provide: getModelToken(Product.name), useValue: mockProductModel },
      ],
    }).compile();

    service = module.get<ProductsSeedService>(ProductsSeedService);
    jest.clearAllMocks(); // limpa as chamadas do onModuleInit
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runSeed()', () => {
    it('insere os seeds quando a coleção está vazia', async () => {
      mockProductModel.countDocuments.mockResolvedValue(0);
      mockProductModel.insertMany.mockResolvedValue([]);

      await service.runSeed();

      expect(mockProductModel.insertMany).toHaveBeenCalledTimes(1);
      expect(mockProductModel.insertMany).toHaveBeenCalledWith(PRODUCT_SEEDS);
    });

    it('pula o insert quando já existem produtos', async () => {
      mockProductModel.countDocuments.mockResolvedValue(5);

      await service.runSeed();

      expect(mockProductModel.insertMany).not.toHaveBeenCalled();
    });

    it('os seeds contêm 5 produtos com os campos obrigatórios', () => {
      expect(PRODUCT_SEEDS).toHaveLength(5);
      PRODUCT_SEEDS.forEach((seed) => {
        expect(seed).toHaveProperty('name');
        expect(seed).toHaveProperty('slug');
        expect(seed).toHaveProperty('price');
        expect(seed).toHaveProperty('stock');
      });
    });
  });
});
