import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ProductsService } from './products.service';
import { Product } from './schemas/product.schema';
import { REDIS_CLIENT } from '../shared/redis.constants';

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

const CACHE_KEY = 'products:all';

describe('ProductsService', () => {
  let service: ProductsService;

  const mockProductModel = {
    find: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
    sort: jest.fn(),
    exec: jest.fn(),
  };

  const mockRedisClient = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockProductModel.find.mockReturnValue(mockProductModel);
    mockProductModel.sort.mockReturnValue(mockProductModel);
    mockProductModel.exec.mockResolvedValue(mockProducts);

    mockRedisClient.get.mockResolvedValue(null); // default: cache miss
    mockRedisClient.setex.mockResolvedValue('OK');
    mockRedisClient.del.mockResolvedValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getModelToken(Product.name), useValue: mockProductModel },
        { provide: REDIS_CLIENT, useValue: mockRedisClient },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── findAll() ────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('should return products sorted by name on cache miss', async () => {
      const result = await service.findAll();
      expect(result).toEqual(mockProducts);
    });

    it('should query the DB and populate the cache on cache miss', async () => {
      await service.findAll();

      expect(mockRedisClient.get).toHaveBeenCalledWith(CACHE_KEY);
      expect(mockProductModel.find).toHaveBeenCalledTimes(1);
      expect(mockProductModel.sort).toHaveBeenCalledWith({ name: 1 });
      expect(mockProductModel.exec).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        CACHE_KEY,
        60,
        JSON.stringify(mockProducts),
      );
    });

    it('should return cached products without querying the DB on cache hit', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockProducts));

      const result = await service.findAll();

      expect(result).toEqual(mockProducts);
      expect(mockRedisClient.get).toHaveBeenCalledWith(CACHE_KEY);
      expect(mockProductModel.find).not.toHaveBeenCalled();
      expect(mockRedisClient.setex).not.toHaveBeenCalled();
    });
  });

  // ─── findById() ───────────────────────────────────────────────────────────

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
        { new: false },
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

    it('should invalidate the cache when stock is successfully decremented', async () => {
      mockProductModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(productWithStock),
      });

      await service.decrementStock(fakeId, 3);

      expect(mockRedisClient.del).toHaveBeenCalledWith(CACHE_KEY);
    });

    it('should NOT invalidate the cache when stock decrement fails (null returned)', async () => {
      mockProductModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await service.decrementStock(fakeId, 100);

      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  // ─── incrementStock() ─────────────────────────────────────────────────────

  describe('incrementStock()', () => {
    const fakeId = '6650a1b2c3d4e5f6a7b8c9d0';

    it('should skip the query for an invalid ObjectId', async () => {
      await service.incrementStock('not-an-objectid', 5);
      expect(mockProductModel.updateOne).not.toHaveBeenCalled();
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should call updateOne with $inc to restore stock', async () => {
      mockProductModel.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });

      await service.incrementStock(fakeId, 3);

      expect(mockProductModel.updateOne).toHaveBeenCalledWith(
        { _id: fakeId },
        { $inc: { stock: 3 } },
      );
    });

    it('should invalidate the cache after incrementing stock', async () => {
      mockProductModel.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });

      await service.incrementStock(fakeId, 3);

      expect(mockRedisClient.del).toHaveBeenCalledWith(CACHE_KEY);
    });
  });
});
