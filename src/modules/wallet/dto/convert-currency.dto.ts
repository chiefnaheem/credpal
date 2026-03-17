import { IsEnum, IsNumber, IsPositive, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from '../../../common/enums';

export class ConvertCurrencyDto {
  @ApiProperty({ enum: Currency, example: Currency.NGN, description: 'Currency to convert from' })
  @IsEnum(Currency)
  fromCurrency: Currency;

  @ApiProperty({ enum: Currency, example: Currency.USD, description: 'Currency to convert to' })
  @IsEnum(Currency)
  toCurrency: Currency;

  @ApiProperty({ example: 1000, description: 'Amount to convert' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ description: 'Unique key to prevent duplicate conversions' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
