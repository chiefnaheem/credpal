import { IsOptional, IsPositive, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsPositive()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1 })
  @IsOptional()
  @IsPositive()
  @Min(1)
  limit?: number = 20;
}
