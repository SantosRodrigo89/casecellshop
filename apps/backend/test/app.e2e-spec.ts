import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Smoke test de bootstrap: verifica que a aplicação sobe e o healthcheck responde.
 * Os 6 cenários de negócio chegam na Fase 7.
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

  it('GET /api/health → 200 ok', () => {
    return request(app.getHttpServer() as Server)
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });
});
