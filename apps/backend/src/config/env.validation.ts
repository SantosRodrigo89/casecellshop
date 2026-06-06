import { plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsString, Min, validateSync } from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

enum ErpFailureMode {
  Never = 'never',
  Always = 'always',
  Rate = 'rate',
}

/**
 * Schema de validação das variáveis de ambiente.
 * Executado no boot via ConfigModule.validate — a aplicação falha rápido
 * se uma variável obrigatória estiver ausente ou mal formatada.
 */
class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  PORT: number = 3001;

  @IsString()
  MONGO_URI: string;

  @IsString()
  REDIS_HOST: string;

  @IsInt()
  @Min(1)
  REDIS_PORT: number;

  @IsEnum(ErpFailureMode)
  ERP_FAILURE_MODE: ErpFailureMode = ErpFailureMode.Never;

  @IsInt()
  @Min(0)
  ERP_LATENCY_MS: number = 500;

  @IsInt()
  @Min(0)
  ERP_TIMEOUT_MS: number = 3000;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Invalid environment variables:\n${errors.toString()}`);
  }

  return validated;
}
