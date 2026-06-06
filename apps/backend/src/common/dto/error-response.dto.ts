import { ApiProperty } from '@nestjs/swagger';

/**
 * Shape emitted by HttpExceptionFilter for every failed request.
 * { statusCode, message, path, timestamp }
 */
export class ErrorResponseDto {
  @ApiProperty({ example: 400, description: 'HTTP status code' })
  statusCode: number;

  /**
   * Single string for most errors; array of strings for class-validator
   * constraint violations (e.g. 400 Bad Request from ValidationPipe).
   */
  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Product not found: 6650a1b2c3d4e5f6a7b8c9d0',
    description: 'Human-readable error message',
  })
  message: string | string[];

  @ApiProperty({
    example: '/api/orders',
    description: 'Request path that produced the error',
  })
  path: string;

  @ApiProperty({
    example: '2026-06-06T12:00:00.000Z',
    description: 'ISO-8601 timestamp of the error',
  })
  timestamp: string;
}
