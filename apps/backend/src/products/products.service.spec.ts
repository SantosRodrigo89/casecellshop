import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ProductsService } from './products.service';
import { Product } from './schemas/product.schema';

const mockProducts = [
  {
    id: '1',
    name: 'Capinha iPhone 15',
    slug: 'capinha-iphone-15',
    price: 39.9,
    stock: 50,
  },
  {
    id: '2',
    name: 'Capinha Moto G',
    slug: 'capinha-moto-g',
    price: 29.9,
    stock: 100,
  },
];

describe('ProductsService', () => {
  let service: ProductsService;

  const mockProductModel = {
    find: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    sort: jest.fn(),
    exec: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockProductModel.find.mockReturnValue(mockProductModel);
    mockProductModel.sort.mockReturnValue(mockProductModel);
    mockProductModel.exec.mockResolvedValue(mockProducts);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getModelToken(Product.name), useValue: mockProductModel },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll()', () => {
    it('should return products sorted by name', async () => {
      const result = await service.findAll();
      expect(result).toEqual(mockProducts);
    });

    it('should call find().sort({ name: 1 }).exec()', async () => {
      await service.findAll();
      expect(mockProductModel.find).toHaveBeenCalledTimes(1);
      expect(mockProductModel.sort).toHaveBeenCalledWith({ name: 1 });
      expect(mockProductModel.exec).toHaveBeenCalledTimes(1);
    });
  });

  describe('findById()', () => {
    it('should return null for an invalid ObjectId', async () => {
      const result = await service.findById('not-an-objectid');
      expect(result).toBeNull();
      expect(mockProductModel.findById).not.toHaveBeenCalled();
    });

    it('should query the model with a valid ObjectId', async () => {
      const fakeId = '6650a1b2c3d4e5f6a7b8c9d0';
      const mockProduct = { id: fakeId, name: 'Capinha', price: 39.9 };
      mockProductModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProduct),
      });

      const result = await service.findById(fakeId);
      expect(mockProductModel.findById).toHaveBeenCalledWith(fakeId);
      expect(result).toEqual(mockProduct);
    });
  });

  // ─── decrementStock() ─────────────────────────────────────────────────────

  describe('decrementStock()', () => {
    const fakeId = '6650a1b2c3d4e5f6a7b8c9d0';
    const productWithStock = {
      id: fakeId,
      name: 'Capinha',
      price: 39.9,
      stock: 10,
    };

    it('should return null for an invalid ObjectId without querying the model', async () => {
      const result = await service.decrementStock('not-an-objectid', 1);
      expect(result).toBeNull();
      expect(mockProductModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should return the pre-update document when stock is sufficient', async () => {
      mockProductModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(productWithStock),
      });

      const result = await service.decrementStock(fakeId, 3);

      expect(mockProductModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: fakeId, stock: { $gte: 3 } },
        { $inc: { stock: -3 } },
      );
      expect(result).toEqual(productWithStock);
    });

    it('should return null when stock is insufficient (model returns null)', async () => {
      mockProductModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.decrementStock(fakeId, 100);
      expect(result).toBeNull();
    });
  });
});
