import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './redis.health';

describe('HealthController', () => {
  let controller: HealthController;

  const healthCheckService = { check: jest.fn() };
  const mongooseIndicator = { pingCheck: jest.fn() };
  const redisIndicator = { isHealthy: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: healthCheckService },
        { provide: MongooseHealthIndicator, useValue: mongooseIndicator },
        { provide: RedisHealthIndicator, useValue: redisIndicator },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('check() should aggregate mongodb and redis indicators', async () => {
    const result = { status: 'ok' };
    healthCheckService.check.mockResolvedValue(result);

    await expect(controller.check()).resolves.toBe(result);
    expect(healthCheckService.check).toHaveBeenCalledTimes(1);
    expect(healthCheckService.check).toHaveBeenCalledWith([
      expect.any(Function),
      expect.any(Function),
    ]);
  });
});
