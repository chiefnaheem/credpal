import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiResponseDto<T> {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  data?: T;

  @ApiPropertyOptional()
  meta?: Record<string, any>;

  static success<T>(data: T, message = 'Success', meta?: Record<string, any>): ApiResponseDto<T> {
    const response = new ApiResponseDto<T>();
    response.success = true;
    response.message = message;
    response.data = data;
    response.meta = meta;
    return response;
  }

  static error(message: string): ApiResponseDto<null> {
    const response = new ApiResponseDto<null>();
    response.success = false;
    response.message = message;
    return response;
  }
}
