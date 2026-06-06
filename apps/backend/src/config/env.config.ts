export const envConfig = () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/casecellshop',
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  erp: {
    failureMode: (process.env.ERP_FAILURE_MODE ?? 'never') as
      | 'never'
      | 'always'
      | 'rate',
    latencyMs: parseInt(process.env.ERP_LATENCY_MS ?? '500', 10),
    timeoutMs: parseInt(process.env.ERP_TIMEOUT_MS ?? '3000', 10),
  },
});
