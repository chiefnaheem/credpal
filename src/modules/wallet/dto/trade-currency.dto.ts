import { IsEnum, IsNumber, IsPositive, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from '../../../common/enums';

export class TradeCurrencyDto {
  @ApiProperty({ enum: Currency, example: Currency.NGN, description: 'Currency you are selling' })
  @IsEnum(Currency)
  fromCurrency: Currency;

  @ApiProperty({ enum: Currency, example: Currency.USD, description: 'Currency you are buying' })
  @IsEnum(Currency)
  toCurrency: Currency;

  @ApiProperty({ example: 5000, description: 'Amount of fromCurrency to sell' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ description: 'Unique key to prevent duplicate trades' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
