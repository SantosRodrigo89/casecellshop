import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { OrdersService } from './orders.service';
import { Order, OrderStatus } from './schemas/order.schema';
import { ProductsService } from '../products/products.service';
import { CreateOrderDto } from './dto/create-order.dto';

const VALID_PRODUCT_ID = '6650a1b2c3d4e5f6a7b8c9d0';

const mockProduct = {
  _id: VALID_PRODUCT_ID,
  name: 'Capinha iPhone 15',
  price: 39.9,
  stock: 50,
};

describe('OrdersService', () => {
  let service: OrdersService;

  const mockOrderModel = {
    create: jest.fn(),
    findById: jest.fn(),
  };

  const mockProductsService = {
    findById: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        { provide: ProductsService, useValue: mockProductsService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── CreateOrderDto ───────────────────────────────────────────────────────

  describe('CreateOrderDto', () => {
    it('should fail when productId is missing', async () => {
      const dto = plainToInstance(CreateOrderDto, { quantity: 1 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'productId')).toBe(true);
    });

    it('should fail when productId is not a valid ObjectId', async () => {
      const dto = plainToInstance(CreateOrderDto, {
        productId: 'invalid',
        quantity: 1,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'productId')).toBe(true);
    });

    it('should fail when quantity is less than 1', async () => {
      const dto = plainToInstance(CreateOrderDto, {
        productId: VALID_PRODUCT_ID,
        quantity: 0,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'quantity')).toBe(true);
    });

    it('should fail when quantity is not an integer', async () => {
      const dto = plainToInstance(CreateOrderDto, {
        productId: VALID_PRODUCT_ID,
        quantity: 1.5,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'quantity')).toBe(true);
    });

    it('should pass with valid data', async () => {
      const dto = plainToInstance(CreateOrderDto, {
        productId: VALID_PRODUCT_ID,
        quantity: 2,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  // ─── create() ────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should return a PENDING order with the correct total', async () => {
      const dto: CreateOrderDto = { productId: VALID_PRODUCT_ID, quantity: 2 };
      const expectedTotal = parseFloat(
        (mockProduct.price * dto.quantity).toFixed(2),
      );

      mockProductsService.findById.mockResolvedValue(mockProduct);
      mockOrderModel.create.mockResolvedValue({
        id: 'order-id-1',
        productId: VALID_PRODUCT_ID,
        quantity: 2,
        unitPrice: mockProduct.price,
        total: expectedTotal,
        status: OrderStatus.PENDING,
        idempotencyKey: 'some-uuid',
      });

      const result = await service.create(dto);

      expect(mockProductsService.findById).toHaveBeenCalledWith(
        VALID_PRODUCT_ID,
      );
      expect(mockOrderModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 2,
          unitPrice: mockProduct.price,
          total: expectedTotal,
          status: OrderStatus.PENDING,
        }),
      );
      expect(result.status).toBe(OrderStatus.PENDING);
      expect(result.total).toBe(expectedTotal);
    });

    it('should throw NotFoundException when the product does not exist', async () => {
      mockProductsService.findById.mockResolvedValue(null);

      await expect(
        service.create({ productId: VALID_PRODUCT_ID, quantity: 1 }),
      ).rejects.toThrow(NotFoundException);

      expect(mockOrderModel.create).not.toHaveBeenCalled();
    });
  });

  // ─── findOne() ───────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('should return the order when found', async () => {
      const mockOrder = { id: 'order-id-1', status: OrderStatus.PENDING };
      mockOrderModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockOrder),
      });

      const result = await service.findOne(VALID_PRODUCT_ID);
      expect(result).toEqual(mockOrder);
    });

    it('should throw NotFoundException when the order does not exist', async () => {
      mockOrderModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOne(VALID_PRODUCT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for an invalid ObjectId', async () => {
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockOrderModel.findById).not.toHaveBeenCalled();
    });
  });
});
