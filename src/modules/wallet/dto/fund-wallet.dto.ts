import { IsEnum, IsNumber, IsPositive, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from '../../../common/enums';

export class FundWalletDto {
  @ApiProperty({ enum: Currency, example: Currency.NGN, description: 'Currency to fund' })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({ example: 10000, description: 'Amount to fund' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ description: 'Unique key to prevent duplicate funding requests' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
