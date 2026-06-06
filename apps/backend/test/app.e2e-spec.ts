import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Bootstrap smoke test: verifies the application starts and the health check
 * aggregates MongoDB and Redis. Requires docker compose up.
 * The 6 business scenario tests arrive in Phase 7.
 */
describe('AppModule (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health should return 200 with status ok', () => {
    return request(app.getHttpServer() as Server)
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          status: string;
          details: Record<string, unknown>;
        };
        expect(body.status).toBe('ok');
        expect(body.details).toHaveProperty('mongodb');
        expect(body.details).toHaveProperty('redis');
      });
  });
});
