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

    // Return a non-zero count so onModuleInit skips the insert during setup.
    mockProductModel.countDocuments.mockResolvedValue(1);
    mockProductModel.insertMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsSeedService,
        { provide: getModelToken(Product.name), useValue: mockProductModel },
      ],
    }).compile();

    service = module.get<ProductsSeedService>(ProductsSeedService);
    jest.clearAllMocks(); // discard calls made by onModuleInit
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runSeed()', () => {
    it('should insert seed data when the collection is empty', async () => {
      mockProductModel.countDocuments.mockResolvedValue(0);
      mockProductModel.insertMany.mockResolvedValue([]);

      await service.runSeed();

      expect(mockProductModel.insertMany).toHaveBeenCalledTimes(1);
      expect(mockProductModel.insertMany).toHaveBeenCalledWith(PRODUCT_SEEDS);
    });

    it('should skip the insert when products already exist', async () => {
      mockProductModel.countDocuments.mockResolvedValue(5);

      await service.runSeed();

      expect(mockProductModel.insertMany).not.toHaveBeenCalled();
    });

    it('seed data should contain 5 products with all required fields', () => {
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
