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
    it('retorna produtos ordenados por nome', async () => {
      const result = await service.findAll();
      expect(result).toEqual(mockProducts);
    });

    it('chama find().sort({ name: 1 }).exec()', async () => {
      await service.findAll();
      expect(mockProductModel.find).toHaveBeenCalledTimes(1);
      expect(mockProductModel.sort).toHaveBeenCalledWith({ name: 1 });
      expect(mockProductModel.exec).toHaveBeenCalledTimes(1);
    });
  });
});
