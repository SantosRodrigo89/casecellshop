import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { OrdersService } from './orders.service';
import { Order, OrderStatus } from './schemas/order.schema';
import { ProductsService } from '../products/products.service';
import { FakeErpService } from '../erp/fake-erp.service';
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
    findOne: jest.fn(),
    updateOne: jest.fn(),
  };

  const mockProductsService = {
    findById: jest.fn(),
    decrementStock: jest.fn(),
    incrementStock: jest.fn(),
  };

  const mockErpService = {
    processOrder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        { provide: ProductsService, useValue: mockProductsService },
        { provide: FakeErpService, useValue: mockErpService },
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
    const idempotencyKey = 'test-idempotency-key-uuid';

    /** Shared setup for the happy-path: product found, no existing order, stock available. */
    function setupHappyPath() {
      const expectedTotal = parseFloat((mockProduct.price * 2).toFixed(2));
      const pendingOrder = {
        _id: 'order-id-1',
        id: 'order-id-1',
        productId: VALID_PRODUCT_ID,
        quantity: 2,
        unitPrice: mockProduct.price,
        total: expectedTotal,
        status: OrderStatus.PENDING,
        idempotencyKey,
      };
      const completedOrder = { ...pendingOrder, status: OrderStatus.COMPLETED };

      mockProductsService.findById.mockResolvedValue(mockProduct);
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null), // no existing order (pre-check)
      });
      mockProductsService.decrementStock.mockResolvedValue(mockProduct);
      mockOrderModel.create.mockResolvedValue(pendingOrder);
      mockOrderModel.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });
      mockErpService.processOrder.mockResolvedValue(undefined);
      mockOrderModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(completedOrder),
      });

      return { expectedTotal, pendingOrder, completedOrder };
    }

    it('should run the full checkout flow and return a COMPLETED order', async () => {
      const dto: CreateOrderDto = { productId: VALID_PRODUCT_ID, quantity: 2 };
      const { expectedTotal, completedOrder } = setupHappyPath();

      const result = await service.create(dto, idempotencyKey);

      expect(mockProductsService.findById).toHaveBeenCalledWith(
        VALID_PRODUCT_ID,
      );
      expect(mockOrderModel.findOne).toHaveBeenCalledWith({ idempotencyKey });
      expect(mockProductsService.decrementStock).toHaveBeenCalledWith(
        VALID_PRODUCT_ID,
        dto.quantity,
      );
      expect(mockOrderModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 2,
          unitPrice: mockProduct.price,
          total: expectedTotal,
          status: OrderStatus.PENDING,
          idempotencyKey,
        }),
      );
      expect(mockErpService.processOrder).toHaveBeenCalledWith('order-id-1');
      expect(result).toEqual(completedOrder);
      expect(result.status).toBe(OrderStatus.COMPLETED);
    });

    it('should throw NotFoundException when the product does not exist', async () => {
      mockProductsService.findById.mockResolvedValue(null);

      await expect(
        service.create({ productId: VALID_PRODUCT_ID, quantity: 1 }, 'any-key'),
      ).rejects.toThrow(
        new NotFoundException(`Product not found: ${VALID_PRODUCT_ID}`),
      );

      expect(mockProductsService.decrementStock).not.toHaveBeenCalled();
      expect(mockOrderModel.create).not.toHaveBeenCalled();
      expect(mockErpService.processOrder).not.toHaveBeenCalled();
    });

    it('should return the existing order without touching stock on idempotency pre-check', async () => {
      const existingOrder = {
        id: 'existing-order-id',
        status: OrderStatus.COMPLETED,
        idempotencyKey,
      };

      mockProductsService.findById.mockResolvedValue(mockProduct);
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingOrder),
      });

      const result = await service.create(
        { productId: VALID_PRODUCT_ID, quantity: 1 },
        idempotencyKey,
      );

      expect(result).toEqual(existingOrder);
      expect(mockProductsService.decrementStock).not.toHaveBeenCalled();
      expect(mockOrderModel.create).not.toHaveBeenCalled();
      expect(mockErpService.processOrder).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when stock is insufficient', async () => {
      mockProductsService.findById.mockResolvedValue(mockProduct);
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockProductsService.decrementStock.mockResolvedValue(null);

      await expect(
        service.create(
          { productId: VALID_PRODUCT_ID, quantity: 999 },
          'any-key',
        ),
      ).rejects.toThrow(
        new ConflictException(
          `Insufficient stock for product: ${VALID_PRODUCT_ID}`,
        ),
      );

      expect(mockOrderModel.create).not.toHaveBeenCalled();
      expect(mockErpService.processOrder).not.toHaveBeenCalled();
    });

    it('should return FAILED order and compensate stock when ERP fails', async () => {
      const dto: CreateOrderDto = { productId: VALID_PRODUCT_ID, quantity: 2 };
      const erpError = new Error('ERP timeout');
      const pendingOrder = {
        _id: 'order-id-2',
        id: 'order-id-2',
        status: OrderStatus.PENDING,
        idempotencyKey,
      };
      const failedOrder = {
        ...pendingOrder,
        status: OrderStatus.FAILED,
        failureReason: 'ERP timeout',
      };

      mockProductsService.findById.mockResolvedValue(mockProduct);
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockProductsService.decrementStock.mockResolvedValue(mockProduct);
      mockOrderModel.create.mockResolvedValue(pendingOrder);
      mockOrderModel.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });
      mockErpService.processOrder.mockRejectedValue(erpError);
      mockProductsService.incrementStock.mockResolvedValue(undefined);
      mockOrderModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(failedOrder),
      });

      const result = await service.create(dto, idempotencyKey);

      expect(result.status).toBe(OrderStatus.FAILED);
      expect(result.failureReason).toBe('ERP timeout');
      expect(mockProductsService.incrementStock).toHaveBeenCalledWith(
        dto.productId,
        dto.quantity,
      );
    });

    it('should restore stock and return the winning order on E11000 (concurrent duplicate)', async () => {
      const dto: CreateOrderDto = { productId: VALID_PRODUCT_ID, quantity: 1 };
      const existingOrder = {
        id: 'winning-order-id',
        status: OrderStatus.COMPLETED,
        idempotencyKey,
      };

      mockProductsService.findById.mockResolvedValue(mockProduct);
      mockOrderModel.findOne
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) }) // pre-check: no existing order
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(existingOrder),
        }); // E11000 catch
      mockProductsService.decrementStock.mockResolvedValue(mockProduct);

      const duplicateKeyError = Object.assign(
        new Error('E11000 duplicate key error'),
        { code: 11000 },
      );
      mockOrderModel.create.mockRejectedValue(duplicateKeyError);
      mockProductsService.incrementStock.mockResolvedValue(undefined);

      const result = await service.create(dto, idempotencyKey);

      expect(result).toEqual(existingOrder);
      expect(mockProductsService.incrementStock).toHaveBeenCalledWith(
        dto.productId,
        dto.quantity,
      );
      expect(mockErpService.processOrder).not.toHaveBeenCalled();
    });

    it('should re-throw non-E11000 errors from orderModel.create', async () => {
      const dto: CreateOrderDto = { productId: VALID_PRODUCT_ID, quantity: 1 };
      const unexpectedError = new Error('Unexpected database error');

      mockProductsService.findById.mockResolvedValue(mockProduct);
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockProductsService.decrementStock.mockResolvedValue(mockProduct);
      mockOrderModel.create.mockRejectedValue(unexpectedError);

      await expect(service.create(dto, 'any-key')).rejects.toThrow(
        unexpectedError,
      );
      expect(mockProductsService.incrementStock).not.toHaveBeenCalled();
    });
  });

  // ─── create() — overselling prevention ───────────────────────────────────

  describe('create() - overselling prevention', () => {
    it('should allow exactly 5 of 10 interleaved requests when stock=5 (sequential exhaustion simulation)', async () => {
      const dto: CreateOrderDto = { productId: VALID_PRODUCT_ID, quantity: 1 };
      let stockRemaining = 5;

      mockProductsService.findById.mockResolvedValue({
        ...mockProduct,
        stock: 5,
      });

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null), // no existing orders
      });

      mockProductsService.decrementStock.mockImplementation(
        (_id: string, qty: number) => {
          if (stockRemaining >= qty) {
            stockRemaining -= qty;
            return Promise.resolve({
              ...mockProduct,
              stock: stockRemaining + qty,
            });
          }
          return Promise.resolve(null);
        },
      );

      const completedOrder = {
        _id: 'order-x',
        id: 'order-x',
        status: OrderStatus.COMPLETED,
      };

      mockOrderModel.create.mockImplementation((doc: Record<string, unknown>) =>
        Promise.resolve({ _id: `id-${Math.random()}`, ...doc }),
      );
      mockOrderModel.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });
      mockErpService.processOrder.mockResolvedValue(undefined);
      mockOrderModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(completedOrder),
      });

      const results = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) => service.create(dto, `key-${i}`)),
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled');
      const failedWithConflict = results.filter(
        (r) => r.status === 'rejected' && r.reason instanceof ConflictException,
      );

      expect(succeeded).toHaveLength(5);
      expect(failedWithConflict).toHaveLength(5);
      expect(stockRemaining).toBe(0);
    });
  });

  // ─── findOne() ───────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('should return the order when found', async () => {
      const mockOrder = { id: 'order-id-1', status: OrderStatus.COMPLETED };
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
        new NotFoundException(`Order not found: ${VALID_PRODUCT_ID}`),
      );
    });

    it('should throw NotFoundException for an invalid ObjectId', async () => {
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        new NotFoundException('Order not found: invalid-id'),
      );
      expect(mockOrderModel.findById).not.toHaveBeenCalled();
    });
  });
});
