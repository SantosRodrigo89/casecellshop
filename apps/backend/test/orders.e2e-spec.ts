/**
 * Orders E2E — 6 mandatory business scenarios.
 *
 * Requires: docker compose up (MongoDB + Redis).
 *
 * The FakeErpService is replaced with a mutable Jest stub via overrideProvider,
 * giving each test full deterministic control over ERP behaviour.
 *
 * Each test gets a fresh product (beforeEach) so stock state never leaks between
 * scenarios. Orders and products are wiped after every test (afterEach).
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { Connection, Model, Types } from 'mongoose';
import { Server } from 'http';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { FakeErpService } from '../src/erp/fake-erp.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import {
  Product,
  ProductDocument,
} from '../src/products/schemas/product.schema';
import {
  Order,
  OrderDocument,
  OrderStatus,
} from '../src/orders/schemas/order.schema';

interface OrderBody {
  id: string;
  status: string;
  failureReason?: string;
  productId: string;
  quantity: number;
  total: number;
}

interface ProductBody {
  id: string;
  stock: number;
}

const INITIAL_STOCK = 10;
const UNIT_PRICE = 29.9;

describe('Orders (e2e)', () => {
  let app: INestApplication;
  let connection: Connection;
  let productModel: Model<ProductDocument>;
  let orderModel: Model<OrderDocument>;
  let productId: string;
  let idempotencyKey: string;

  /** Mutable ERP stub — tests configure it via mockResolvedValue / mockRejectedValue. */
  const erpStub = { processOrder: jest.fn() };

  // Saved so they can be restored after the suite, preventing cross-suite env pollution
  // when Jest runs test files in the same process (e.g. --runInBand).
  let originalMongoUri: string | undefined;
  let originalNodeEnv: string | undefined;
  let originalErpFailureMode: string | undefined;
  let originalErpLatencyMs: string | undefined;

  beforeAll(async () => {
    originalMongoUri = process.env.MONGO_URI;
    originalNodeEnv = process.env.NODE_ENV;
    originalErpFailureMode = process.env.ERP_FAILURE_MODE;
    originalErpLatencyMs = process.env.ERP_LATENCY_MS;

    // Point to a dedicated test database to avoid polluting the dev database.
    process.env.MONGO_URI = 'mongodb://localhost:27017/casecellshop-e2e';
    process.env.REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
    process.env.REDIS_PORT = process.env.REDIS_PORT ?? '6379';
    process.env.NODE_ENV = 'test';
    process.env.ERP_FAILURE_MODE = 'never';
    process.env.ERP_LATENCY_MS = '0';
    process.env.ERP_TIMEOUT_MS = '3000';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FakeErpService)
      .useValue(erpStub)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    connection = app.get<Connection>(getConnectionToken());
    productModel = app.get<Model<ProductDocument>>(getModelToken(Product.name));
    orderModel = app.get<Model<OrderDocument>>(getModelToken(Order.name));

    // Ensure a clean slate for the entire suite.
    await connection.dropDatabase();
  });

  afterAll(async () => {
    await connection.dropDatabase();
    await app.close();

    // Restore env vars so subsequent suites in the same process see a clean state.
    process.env.MONGO_URI = originalMongoUri;
    process.env.NODE_ENV = originalNodeEnv;
    process.env.ERP_FAILURE_MODE = originalErpFailureMode;
    process.env.ERP_LATENCY_MS = originalErpLatencyMs;
  });

  beforeEach(async () => {
    idempotencyKey = randomUUID();
    erpStub.processOrder.mockResolvedValue(undefined); // default: ERP succeeds

    // Fresh product for each test — stock state never leaks between scenarios.
    const product = await productModel.create({
      name: 'E2E Test Case',
      slug: `e2e-test-case-${randomUUID()}`,
      price: UNIT_PRICE,
      stock: INITIAL_STOCK,
    });
    productId = String(product._id);
  });

  afterEach(async () => {
    await orderModel.deleteMany({});
    await productModel.deleteMany({});
  });

  // ─── Scenario 1: Successful purchase ─────────────────────────────────────

  it('Scenario 1 — successful purchase: order COMPLETED and stock decremented', async () => {
    const qty = 2;

    const res = await request(app.getHttpServer() as Server)
      .post('/api/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send({ productId, quantity: qty })
      .expect(201);

    const body = res.body as OrderBody;
    expect(body.status).toBe(OrderStatus.COMPLETED);
    expect(body.productId).toBe(productId);
    expect(body.quantity).toBe(qty);
    expect(body.total).toBeCloseTo(UNIT_PRICE * qty, 2);

    // Verify the order is retrievable and in COMPLETED state.
    const orderRes = await request(app.getHttpServer() as Server)
      .get(`/api/orders/${body.id}`)
      .expect(200);
    expect((orderRes.body as OrderBody).status).toBe(OrderStatus.COMPLETED);

    // Verify stock was decremented by the purchased quantity.
    const productsRes = await request(app.getHttpServer() as Server)
      .get('/api/products')
      .expect(200);
    const product = (productsRes.body as ProductBody[]).find(
      (p) => p.id === productId,
    );
    expect(product?.stock).toBe(INITIAL_STOCK - qty);
  });

  // ─── Scenario 2: Invalid quantity ────────────────────────────────────────

  it('Scenario 2 — invalid quantity: HTTP 400', async () => {
    await request(app.getHttpServer() as Server)
      .post('/api/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send({ productId, quantity: 0 })
      .expect(400);
  });

  // ─── Scenario 3: Product not found ───────────────────────────────────────

  it('Scenario 3 — product not found: HTTP 404', async () => {
    const unknownId = new Types.ObjectId().toString();

    await request(app.getHttpServer() as Server)
      .post('/api/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send({ productId: unknownId, quantity: 1 })
      .expect(404);
  });

  // ─── Scenario 4: Insufficient stock ──────────────────────────────────────

  it('Scenario 4 — insufficient stock: HTTP 409', async () => {
    await request(app.getHttpServer() as Server)
      .post('/api/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send({ productId, quantity: INITIAL_STOCK + 1 })
      .expect(409);
  });

  // ─── Scenario 5: Duplicate Idempotency-Key ───────────────────────────────

  it('Scenario 5 — duplicate Idempotency-Key: same order returned, no duplicate created', async () => {
    // First request — creates and completes the order.
    const res1 = await request(app.getHttpServer() as Server)
      .post('/api/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send({ productId, quantity: 1 })
      .expect(201);

    const body1 = res1.body as OrderBody;
    expect(body1.status).toBe(OrderStatus.COMPLETED);

    // Second request with the same key — must return the identical order.
    const res2 = await request(app.getHttpServer() as Server)
      .post('/api/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send({ productId, quantity: 1 })
      .expect(201);

    const body2 = res2.body as OrderBody;
    expect(body2.id).toBe(body1.id);
    expect(body2.status).toBe(OrderStatus.COMPLETED);

    // Exactly one order must exist in the database for this key.
    const count = await orderModel.countDocuments({ idempotencyKey });
    expect(count).toBe(1);
  });

  // ─── Scenario 6: ERP failure ─────────────────────────────────────────────

  it('Scenario 6 — ERP failure: order FAILED and stock fully restored', async () => {
    const qty = 3;
    erpStub.processOrder.mockRejectedValue(new Error('ERP timeout'));

    const res = await request(app.getHttpServer() as Server)
      .post('/api/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send({ productId, quantity: qty })
      .expect(201);

    const body = res.body as OrderBody;
    expect(body.status).toBe(OrderStatus.FAILED);
    expect(body.failureReason).toBe('ERP timeout');

    // Verify stock was fully restored — no net change from original value.
    const productsRes = await request(app.getHttpServer() as Server)
      .get('/api/products')
      .expect(200);
    const product = (productsRes.body as ProductBody[]).find(
      (p) => p.id === productId,
    );
    expect(product?.stock).toBe(INITIAL_STOCK);
  });
});
